# Módulo Chamados — Guia técnico (D-029 e D-030)

> Documento de referência para quem vai **manter ou evoluir** o módulo de chamados do Suporte
> Skills. Cobre o espelho do **Zoho Desk** (D-029) e a camada posterior (D-030): **integração
> Zoho configurável pela interface**, **lançamentos de tempo**, **contratos**, **Relatório
> Financeiro** (e-mail) e **Relatório do Cliente** (PDF/HTML). Comece por aqui e siga os links
> para [API](./API.md), [Banco](./DATABASE.md), [Decisões](./DECISIONS.md), [QA](./QA.md) e
> [Release](./RELEASE.md).

## 1. Visão geral

O módulo transforma o atendimento registrado no **Zoho Desk** em **comprovação de serviço e
faturamento** para os clientes da Suporte Informática. Em duas metades:

1. **Espelho (somente leitura) do Zoho Desk.** Os chamados e seus **lançamentos de tempo** são
   copiados para o banco local. Nada é escrito no Zoho. O espelho é **incremental** (por
   `modifiedTime`) e **idempotente** (upsert pelo id interno do chamado).
2. **Relatórios por cliente/período.** Sobre o espelho + os **contratos**, o sistema calcula as
   métricas de atendimento (B2) e o **faturamento** (B3: franquia, horas adicionais, política de
   saldo), e produz:
   - **Relatório Financeiro** → e-mail (HTML + texto) para o Financeiro, com **PDF anexo**, no
     padrão `[Liberação de Faturamento] {cliente} – {mm/aaaa} – {PADRÃO|COM HORAS ADICIONAIS}`.
   - **Relatório do Cliente** → PDF/HTML com identidade visual, KPIs e gráficos, **sem valores**
     de contrato.

```text
 Zoho Desk ──(OAuth, leitura)──► [ ZohoClient ] ──► Sync (incremental)
        GET /tickets, /tickets/{id}/timeEntries          │
                                                          ▼
                        ┌──────────── tickets ─────────────┐
                        │  clientes (Client)  contratos    │
                        │  time_entries       (Contract)   │
                        └───────────────┬──────────────────┘
                                        ▼
                       Relatórios de Chamados (métricas B2 + B3)
                        │                       │
          Relatório Financeiro            Relatório do Cliente
          (e-mail + PDF)                  (PDF/HTML com branding)
```

Tudo é **opt-in**: desligado, o módulo responde `404` e some do menu.

## 2. Glossário

| Termo | Significado |
|-------|-------------|
| **Chamado (Ticket)** | Solicitação de atendimento espelhada do Zoho Desk; chave `zoho_ticket_id`. |
| **Lançamento (TimeEntry)** | Registro de tempo de um chamado (`/timeEntries`), de um agente, com minutos, `executedTime` e `isBillable`. |
| **Cliente (Client)** | Cadastro local que liga um chamado a um **contrato**; identificado por `zoho_account_id` (Account do Zoho). |
| **Contrato (Contract)** | Franquia mensal (minutos), valor mensal, valor da hora adicional e política de saldo (`EXPIRE`/`ACCUMULATE`). |
| **Medição Mensal (D-029)** | Consolidação por cliente/mês usada como **comprovação de serviço** (CSV/PDF). Reutiliza chamados por `close_date`. |
| **Relatório de Chamados (D-030)** | Métricas B2 (atendimento) + B3 (faturamento) por cliente/período, com prévia, alertas e geração de relatórios. |
| **`generated_reports`** | Auditoria dos relatórios gerados/enviados (tipo, período, status, quem gerou, quando enviou). |
| **orgId** | Cabeçalho obrigatório das chamadas de dados do Zoho Desk (a "organização"). |
| **Data center** | `com|eu|in|au|cn|jp` — define os domínios da API e do OAuth. |

## 3. Como ligar/desligar (feature flags)

| Flag | Onde | Efeito |
|------|------|--------|
| `TICKETS_ENABLED` | backend (env) | `false` (padrão) → **todas** as rotas do módulo (`/clients`, `/tickets`, `/measurements`, `/contracts`, `/ticket-reports`, `/settings/zoho`, `/settings/email`, `/settings/branding`) respondem **`404`** (via `TicketsEnabledGuard`). |
| `VITE_TICKETS_ENABLED` | frontend (build) | `false` (padrão) → menu e rotas do módulo **não** aparecem. Deve acompanhar o backend. |
| `ZOHO_SYNC_ENABLED` | backend (env) | `false` (padrão) → o **agendador** de sincronização fica desligado. **Só leitura** no Zoho. Obs.: pela interface, a frequência (`MANUAL|HOURLY|SIX_HOURS|DAILY`) sobrepõe o env. |

> Sem `TICKETS_ENABLED`, `ZOHO_SYNC_ENABLED=true` levanta um erro de validação de ambiente (as
> credenciais `ZOHO_*` passam a ser exigidas). As flags são independentes da
> `NEWS_SYNC_ENABLED`.

## 4. Modelo de dados

Tabelas (detalhes de colunas em [DATABASE.md](./DATABASE.md)):

| Tabela | Papel | Chaves/índices notáveis |
|--------|-------|-------------------------|
| `clients` | Cliente + `zoho_account_id` (Account do Zoho) + `active`. | `zoho_account_id` único quando informado. |
| `tickets` | Chamado espelhado. | `zoho_ticket_id` **único**; `(client_id, close_date)`; `technology_name`. |
| `time_entries` | Lançamentos de tempo (por agente). | `zoho_time_entry_id` **único**; `ticket_id` (FK, `onDelete: Cascade`); `executed_at`. |
| `contracts` | Contrato do cliente. | `client_id` (FK, `Restrict`); `balance_policy`; vigência. |
| `unmapped_tickets` | Fila de chamados sem cliente mapeado. | `zoho_ticket_id` único. |
| `monthly_measurements` / `monthly_measurement_items` | Medição Mensal (D-029). | `(client_id, year, month)` único. |
| `generated_reports` | Auditoria dos relatórios gerados/enviados. | `(client_id, type)`; `generated_by_id` (FK `SetNull`). |
| `app_settings` | Configurações (JSON): `zoho`, `email`, `branding`, `zoho_sync`. | `key` (PK). |

**Relações-chave:** `Client 1─N Ticket`, `Client 1─N Contract`, `Ticket 1─N TimeEntry`,
`Client 1─N GeneratedReport`, `Professional 1─N GeneratedReport (generatedBy)`,
`Ticket 1─N MonthlyMeasurementItem`.

> `Ticket.time_spent_minutes` passa a ser a **soma** dos lançamentos de tempo (D-030), mantido
> assim na sincronização (`afterTicketWrite`). Se a busca de lançamentos falhar, mantém-se o valor
> anterior (não zera).

Campos adicionados em `tickets` na D-030: `contact_id`, `department_id`, `account_id`,
`account_name`, `assignee_id`, `technology_name` (todos opcionais).

## 5. Backend — camadas e arquivos

### 5.1 Configurações (`app_settings`)

Quatro chaves JSON, todas editáveis pela interface (ADMIN), em `backend/src/modules/...`:

| Chave | Serviço | Conteúdo | Segredos |
|-------|---------|----------|----------|
| `zoho` | `tickets/zoho/zoho-settings.service.ts` | data center, `clientId`, `orgId`, escopos, `technologyField`, `clientSource`, `closedStatuses`, frequência | `clientSecretEnc`, `refreshTokenEnc` (**cifrados**) |
| `email` | `settings/email-settings.service.ts` | transporte (`SMTP`/`GRAPH`), remetente, host/porta etc. | `smtpPasswordEnc`, `graphClientSecretEnc` (**cifrados**) |
| `branding` | `settings/branding-settings.service.ts` | nome, cores, logo (data URL), contatos | — |
| `zoho_sync` | `tickets/zoho-sync.service.ts` | última execução + histórico das 20 últimas sincronizações | — |

**Cifra:** AES-256-GCM em `shared/crypto/secret-crypto.ts`; segredo derivado por
`shared/crypto/encryption-secret.ts` (`SETTINGS_ENCRYPTION_KEY`, fallback `JWT_ACCESS_SECRET`).
Segredos **nunca** são devolvidos pela API (a resposta traz `clientSecretSet`/`refreshTokenSet`
etc.). O **banco sobrepõe o ambiente**.

### 5.2 Cliente Zoho

- `tickets/zoho/zoho-domains.ts` — mapa **data center → domínios** (`au` → `desk.zoho.com.au`,
  `jp` → `desk.zoho.jp`, etc.), escopos e frequências padrão.
- `tickets/zoho/zoho-settings.service.ts` — resolve a configuração efetiva (banco > env), com
  cache em memória (`getResolved()`).
- `tickets/zoho/zoho-credentials.service.ts` — **fachada** síncrona usada pelo resto do código:
  `get()`, `isConfigured()`, `isSyncEnabled()`, `maxTicketsPerRun()`.
- `tickets/zoho/zoho-client.service.ts` — HTTP do Zoho: `refresh_token` → access token
  (cacheado), `listTickets()` (paginado), `listTimeEntries(id)`, `testConnection()` e
  `exchangeCode()` (OAuth). Erros viram `ZohoApiError(status, code, message)` e são traduzidos
  para mensagens úteis (ex.: `OAUTH_ORG_MISMATCH` → "orgId não corresponde à organização").

### 5.3 OAuth ("Conectar com Zoho")

- `tickets/zoho/zoho-oauth.service.ts` — `startUrl(actor)` monta a URL de consentimento
  (`accounts.{dc}/oauth/v2/auth`) com escopos, `access_type=offline`, `prompt=consent`, a
  `redirect_uri` derivada e um **`state` nonce** (TTL 10 min). `handleCallback(code, state)` valida
  o `state`, troca o `code` pelo **refresh token**, salva **cifrado** e tenta uma validação leve.
- `tickets/zoho/zoho-oauth.controller.ts` — `GET /settings/zoho/callback` é **público** (o
  navegador volta do Zoho sem JWT); a segurança é o `state`. Ao fim, redireciona para
  `PUBLIC_WEB_URL/configuracoes?zoho=connected|error`. A `redirect_uri` é
  `${PUBLIC_API_URL}/api/v1/settings/zoho/callback`.

### 5.4 Sincronização

- `tickets/zoho-sync.service.ts` — orquestra o sync: busca `GET /tickets` com
  `sortBy=modifiedTime` e marca d'água em `zoho_sync.lastModifiedAt`; para cada chamado,
  **upsert por `zoho_ticket_id`**; se o `accountId` não casar com nenhum `Client.zoho_account_id`,
  vai para **`unmapped_tickets`** (não se adivinha o cliente). Após gravar o chamado,
  `afterTicketWrite` busca `timeEntries`, faz upsert por `zoho_time_entry_id`, remove lançamentos
  que sumiram e **recalcula `time_spent_minutes` = Σ minutos**. Registra o **histórico** (20
  últimas execuções).
- `tickets/zoho-sync.scheduler.ts` — `setInterval` conforme a **frequência efetiva** (`MANUAL`
  desliga); roda `syncAll` em background.

Rate limit/robustez: paginação `from`/`limit`, timeout por requisição (`ZOHO_FETCH_TIMEOUT_MS`),
teto por execução (`ZOHO_MAX_TICKETS_PER_RUN`) e refresh automático do token (com 1 retry em 401
no fluxo de token).

### 5.5 Tickets e Clientes (D-029)

- `tickets/tickets.service.ts` / `.controller.ts` — leitura de chamados (lista com filtros e
  detalhe) e o `TICKET_SELECT` (expõe os campos novos).
- `modules/clients/*` — CRUD de clientes (ADMIN/MANAGER).
- `tickets/zoho/ticket-mapper.ts` — funções **puras** `mapZohoTicket(payload, technologyField)`
  e `mapZohoTimeEntry(entry, ticketId)` (convertem h/m/s → minutos inteiros).

### 5.6 Contratos e regra de faturamento (B3)

- `tickets/contracts/*` — CRUD `/contracts` (validações, auditoria, soft delete).
- `tickets/billing.ts` — **funções puras**:
  - `computeBilling({ includedMinutes, monthlyValue, extraHourValue, balancePolicy,
    consumedMinutes, carriedMinutes })` → `{ status, extraMinutes, extraAmount, totalValue, … }`.
  - `computeCarriedMinutes(policy, includedMinutes, priorConsumptions[])` → saldo (minutos) dos
    meses anteriores (só `ACCUMULATE`; `EXPIRE` → 0).

### 5.7 Relatórios de Chamados (métricas B2 + prévia)

`tickets/reports/ticket-reports.service.ts`:

- `resolvePeriod(dto)` — período por `year`+`month` (via `zonedMonthRange`) **ou** `from`+`to`
  (via `zonedDayRange`), no **fuso de negócio** (`BUSINESS_TIMEZONE`).
- `preview(dto)` — **B2**: `closedCount` (por `closeDate` no período), `openedCount`
  (`openDate` no período), `openAtEndCount` (`closeDate` nulo e aberto antes do fim), horas
  (Σ `time_entries` por `executedAt`), tempo médio de solução, **horas e chamados por
  tecnologia**; aplica **B3** quando há contrato; monta **alertas**.
- `generate()` — grava `generated_reports` (tipo, período, status, autor) e **audita**.
- `list()` / `getById()` — lista/detalhe dos relatórios gerados.

### 5.8 Relatório Financeiro

- `tickets/financial-report.ts` — monta **assunto/corpo HTML+texto** (tabela + bloco de status,
  pt-BR: `R$ 1.234,56`, `dd/mm/aaaa`). Funções puras (testadas).
- `shared/reporting/email.ts` — `buildMimeMessage()` (multipart/mixed → alternative + anexos),
  `encodeHeader()` (RFC 2047), `formatCurrencyBRL()`, `formatDateBR()`.
- `shared/reporting/pdf.ts` — gerador de PDF sem dependência (ver §5.10).
- `settings/mailer.service.ts` — envia por **SMTP** (socket próprio: EHLO, STARTTLS opcional,
  AUTH LOGIN, MAIL/RCPT/DATA) ou **Microsoft Graph** (HTTP `client_credentials` + `sendMail`).
- Endpoints em `reports/ticket-reports.service.ts`: `financialPreview`, `financialPdf`,
  `financialEml`, `sendFinancial` (exige `confirm: true`; grava `sentAt`/`sentTo`).

### 5.9 Relatório do Cliente

- `tickets/client-report.ts` — **HTML** auto-contido com identidade visual, KPIs, barra de
  franquia, **gráficos SVG** (tecnologias; evolução abertos × fechados), campos editáveis
  ("principais atuações"/"recomendações"), tabela e rodapé. **Nunca** inclui `R$`.
- PDF: monta as linhas e usa `buildPdf` com `header`/`tableHeader` (repetidos) e `footer`
  (`Página {{page}} de {{total}}`) + um **gráfico vetorial** de tecnologias.

### 5.10 Utilitários de PDF

`shared/reporting/pdf.ts` — PDF 1.4 sem dependência. `buildPdf(rows)` mantém o comportamento
simples; `buildPdf(rows, { header, tableHeader, footer, charts })` habilita **cabeçalho/rodapé
repetidos**, **paginação** e **gráficos de barras** (retângulos preenchidos). Texto em
Helvetica/WinAnsi (acentos do pt-BR).

## 6. API

Endpoints completos em [API.md](./API.md). Resumo:

| Grupo | Rotas |
|-------|-------|
| **Clientes** | `GET/POST/PUT/PATCH/DELETE /clients` |
| **Chamados** | `GET /tickets`, `GET /tickets/:id`, `GET /tickets/unmapped`, `POST /tickets/unmapped/:id/link`, `GET /tickets/sync/status`, `POST /tickets/sync` |
| **Medições (D-029)** | `/measurements` (+ `close/reopen`, `export.csv|pdf`) |
| **Contratos** | `GET/POST/PUT/PATCH/DELETE /contracts` |
| **Relatórios** | `GET /ticket-reports/preview`; `POST /ticket-reports`; `GET /ticket-reports[/:id]` |
| **Financeiro** | `GET /ticket-reports/financial/{preview,attachment.pdf,eml}`; `POST /ticket-reports/financial/send` |
| **Cliente** | `GET /ticket-reports/client/{preview,pdf}` |
| **Config Zoho** | `GET/PUT /settings/zoho`; `GET /settings/zoho/auth-url`; `GET /settings/zoho/callback` (público); `POST /settings/zoho/{test,sync,disconnect}`; `GET /settings/zoho/sync-log` |
| **Config e-mail** | `GET/PUT /settings/email`; `POST /settings/email/test` |
| **Identidade visual** | `GET/PUT /settings/branding` |

RBAC: **ADMIN** edita Configurações; **ADMIN/MANAGER** usam o resto. **CONSULTANT** → `403`.

## 7. Regras de negócio (B2 e B3)

**B2 — métricas por cliente/período** (período no fuso de negócio, `[start, end)`):

- **Fechados no período:** `closeDate ∈ [start, end)`.
- **Abertos no período:** `openDate ∈ [start, end)`.
- **Abertos ao fim:** `closeDate = null` **e** `openDate < end` (inclui os criados no período).
- **Horas gastas:** Σ `time_entries.minutes` com `executedAt ∈ [start, end)`.
- **Tempo médio de solução:** média de `closeDate − openDate` dos fechados no período.
- **Por tecnologia:** tecnologias dos lançamentos no período (chamados distintos + horas).

**B3 — faturamento:**

```
disponível = franquia + (saldo anterior, se ACCUMULATE; senão 0)
adicionais = max(0, minutos_consumidos − disponível)
horas_extra = adicionais / 60
valor_extra = horas_extra × valor_hora_adicional
status = (adicionais == 0) ? "PADRÃO" : "COM HORAS ADICIONAIS"
total  = valor_mensal + valor_extra
saldo  = Σ (franquia − consumido) dos meses anteriores   [ACCUMULATE; pode ser negativo]
```

Exemplo (franquia 60 min, mensal R$ 1.000, hora adicional R$ 200, consumido 90 min, sem saldo):
`adicionais = 30` → `0,5h × 200 = R$ 100` → **total = R$ 1.100**, status **COM HORAS ADICIONAIS**.

## 8. Frontend

Padrão: react-query + react-hook-form/zod + componentes `ui/*`. Tudo atrás de
`TICKETS_ENABLED` (config `frontend/src/config/features.ts`).

| Área | Arquivo |
|------|---------|
| Cards de Configurações | `features/settings/{zoho,email,branding}-settings-card.tsx` (e `ai-settings-card.tsx`) |
| Clientes | `features/tickets/clients-page.tsx` + `client-form-dialog.tsx` |
| Chamados | `features/tickets/tickets-page.tsx` + `unmapped-dialog.tsx` |
| Medições | `features/tickets/measurements-page.tsx` + `measurement-detail-dialog.tsx` + `generate-measurement-dialog.tsx` |
| Contratos | `features/tickets/contracts-page.tsx` + `contract-form-dialog.tsx` |
| Relatórios de Chamados | `features/tickets/ticket-reports-page.tsx` + `financial-preview-dialog.tsx` |
| Serviços | `services/{clients,tickets,measurements,contracts,ticket-reports,zoho-settings,settings}.service.ts` |
| Tipos | `types/tickets.ts`, `types/reports.ts` |
| Navegação/rotas | `layouts/navigation.ts`, `App.tsx` |

O relatório do cliente é aberto numa nova aba (Blob HTML) e o PDF é baixado. O envio do
Relatório Financeiro passa por **diálogo de confirmação**.

## 9. Variáveis de ambiente

Além das gerais (README), as do módulo:

| Variável | Uso |
|----------|-----|
| `TICKETS_ENABLED` | Liga o módulo (padrão `false`). |
| `VITE_TICKETS_ENABLED` | Liga o menu/rotas no SPA (build). |
| `ZOHO_SYNC_ENABLED` / `ZOHO_SYNC_INTERVAL_MINUTES` | Padrões do agendador (a UI sobrepõe a frequência). |
| `ZOHO_FETCH_TIMEOUT_MS` / `ZOHO_MAX_TICKETS_PER_RUN` | Timeout (15 s) e teto por execução (200). |
| `ZOHO_CLIENT_ID`/`_SECRET`/`_REFRESH_TOKEN`/`_ORG_ID` | Credenciais (fallback; a UI tem prioridade). |
| `ZOHO_API_BASE_URL` / `ZOHO_ACCOUNTS_BASE_URL` | **Override** de domínio (vazio = derivado do data center; útil p/ mock). |
| `SETTINGS_ENCRYPTION_KEY` | Segredo da cifra (fallback `JWT_ACCESS_SECRET`). |
| `PUBLIC_API_URL` | Base da **Redirect URI** do OAuth. |
| `PUBLIC_WEB_URL` | Destino do retorno do OAuth. |
| `BUSINESS_TIMEZONE` | Fuso dos cálculos (padrão `America/Sao_Paulo`; produção: `America/Recife`). |
| `EMAIL_GRAPH_LOGIN_BASE_URL` / `EMAIL_GRAPH_BASE_URL` | Overrides do Graph (teste). |

## 10. Operação (configurar pela interface, ADMIN)

1. **Configurações > Integração Zoho Desk**: escolher o **data center**, informar **Client
   ID/Secret** e **orgId**, definir o **campo de tecnologia** (nome de API do campo
   personalizado), a **origem do cliente** (Account/Contact) e a **frequência**; **Salvar**.
2. **Conectar com Zoho** (abre o consentimento; autorize na aba). A volta marca "Conectado".
3. **Testar conexão** (chama `GET /tickets?limit=1` e mostra erro detalhado se falhar).
4. **Configurações > Envio de e-mail**: SMTP **ou** Microsoft Graph + **Enviar teste**.
5. **Configurações > Identidade Visual**: nome, cores e logo.
6. **Contratos**: cadastrar franquia/valores/política por cliente.
7. **Relatórios de Chamados**: escolher cliente e período → **Gerar prévia** → revisar
   métricas/alertas → **Registrar**, **Prévia do Cliente** (HTML), **PDF do Cliente** ou
   **Relatório Financeiro** (prévia + Copiar/Baixar .eml/Enviar).

## 11. Sincronização

- **Incremental:** só o que mudou desde a última execução (`modifiedTime`).
- **Idempotente:** rodar de novo não duplica (upsert por id interno).
- **Não mapeados** vão para `unmapped_tickets`; vincule na tela **Tickets > Não mapeados**.
- **Log:** histórico em `app_settings` (`zoho_sync.history`), exposto em
  `GET /settings/zoho/sync-log` e na tela de Configurações.
- **Rate limit:** paginação + timeout; o teto por execução (`ZOHO_MAX_TICKETS_PER_RUN`) evita
  varreduras longas.

## 12. Segurança

- **Segredos cifrados** em repouso (AES-256-GCM) e **nunca** devolvidos/logados.
- **Callback OAuth público** protegido por **`state`** (nonce de uso único, TTL 10 min).
- **RBAC**: Configurações só **ADMIN**; relatórios **ADMIN/MANAGER**; `TicketsEnabledGuard` liga
  tudo a `TICKETS_ENABLED`.
- **Somente leitura** no Zoho (nenhum POST/PUT é enviado ao Zoho).
- **Envio de e-mail** exige **`confirm: true`** explícito e é **auditado**.

## 13. Testes

- **Unitários** (`npm run test`, `node --test`): `billing.spec.ts` (B2/B3), `ticket-mapper.spec.ts`
  (campos + tempo), `zoho-settings.service.spec.ts`, `zoho-client.service.spec.ts`,
  `zoho-sync.service.spec.ts`, `financial-report.spec.ts`, `client-report.spec.ts`,
  `email.spec.ts`, `pdf.spec.ts`, `business-time.spec.ts` (**virada de mês no fuso**).
- **Aceite** (`scripts/acceptance.sh`): bloco **11i** (Tickets/Medições) e **11j** (Chamados:
  contratos, B2/B3/alertas, Financeiro/`.eml`/`send` com `confirm`, Cliente PDF, Config). Ver
  [QA.md](./QA.md).
- **Smoke** (`scripts/smoke.sh`): não-destrutivo; inclui leituras do módulo. Ideal pós-deploy.

## 14. Deploy e rollback

Runbook completo em [RELEASE.md](./RELEASE.md). A VM roda um **checkout git**; o deploy padrão é:

```bash
cd /home/renato/suporte-skills
bash scripts/deploy.sh            # fetch+checkout, backup, build, up, health, release
bash scripts/deploy.sh v0.9.0     # (opcional) checkout de uma tag especifica
```

O script faz `git fetch/checkout`, **backup** do banco (dump via container), `build` (api+web),
`up -d`, aguarda `/health=200` e cria a **release do changelog** (a partir de
`scripts/releases/<versão>.json`). As migrações rodam no start do container da API
(`prisma migrate deploy` — **aditivas**). **Nunca** use `seed`/`acceptance.sh` na VM (dados reais);
valide com `scripts/smoke.sh`.

**Rollback:** desligar a flag (`TICKETS_ENABLED=false` + rebuild com `VITE_TICKETS_ENABLED=false`)
→ `git checkout <tag anterior>` + `docker compose up -d --build` → (se preciso) restaurar o dump
pré-deploy ou aplicar `database/rollbacks/chamados_fase1_down.sql`.

## 15. Solução de problemas

| Sintoma | Causa provável | Ação |
|---------|----------------|------|
| Rotas do módulo dão `404` | `TICKETS_ENABLED=false` | Ligar a flag no backend (e `VITE_TICKETS_ENABLED=true` no SPA). |
| Menu não aparece | SPA não recompilado com a flag | Rebuild com o build arg `VITE_TICKETS_ENABLED=true`. |
| "Client ID/Secret inválidos" no teste | credenciais erradas ou data center errado | Revisar em Configurações; conferir o **data center**. |
| "orgId não corresponde…" | `orgId` de outra organização | Corrigir o `orgId`. |
| "Escopos insuficientes" | escopos do consentimento | Reconectar com os escopos corretos. |
| Envio de e-mail `503` | e-mail não configurado/habilitado | Configurações > Envio de e-mail + "Enviar teste". |
| Envio `400` | faltou `confirm: true` (ou destinatário) | Confirmar no diálogo / informar o destinatário. |
| Horas do chamado = 0 | sem lançamentos no Zoho ou falha ao buscá-los | Ver o log de sync; conferir `/tickets/{id}/timeEntries` no Zoho. |
| Relatório do cliente com "sem tecnologia" | `technologyField` não configurado | Definir o campo em Configurações > Zoho. |
| Login `429` "Muitas tentativas" | limitador de login (em memória) | Aguardar a janela ou reiniciar a API; ver `AUTH_LOGIN_MAX_ATTEMPTS`. |

## 16. Mapa de arquivos

```text
backend/src/
  config/configuration.ts, env.validation.ts        # flags e variáveis
  shared/
    crypto/secret-crypto.ts, encryption-secret.ts   # AES-256-GCM
    reporting/pdf.ts, email.ts                      # PDF e MIME
    common/business-time.ts                         # fuso (mês/dia)
    guards/tickets-enabled.guard.ts                 # 404 quando desligado
  modules/
    clients/                                        # CRUD de clientes
    settings/
      email-settings.service.ts, mailer.service.ts  # e-mail (SMTP/Graph)
      branding-settings.service.ts                  # identidade visual
      settings.controller.ts, settings.module.ts
    tickets/
      tickets.service.ts, tickets.controller.ts
      zoho-sync.service.ts, zoho-sync.scheduler.ts
      billing.ts                                    # B3 (puro)
      financial-report.ts, client-report.ts         # conteúdo dos relatórios
      contracts/                                     # CRUD de contratos
      reports/                                       # métricas B2 + prévia + geração
      zoho/                                           # settings, client, oauth, mapper, domains
frontend/src/  (features/tickets, features/settings, services, types/reports.ts)
database/rollbacks/chamados_fase1_down.sql
scripts/{acceptance,smoke}.sh
docs/{API,DATABASE,DECISIONS,QA,RELEASE}.md
```

---

_Dúvidas de produto/regra: [PRODUCT_REQUIREMENTS.md](./PRODUCT_REQUIREMENTS.md) e
[DECISIONS.md](./DECISIONS.md) (D-029, D-030)._
