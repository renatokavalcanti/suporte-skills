# API — Suporte Skills

Base: `/api/v1` · JSON · autenticação por Bearer token (access JWT), exceto
rotas `@Public()`.

## Convenções

- Erros: `{ "error": { "code": string, "message": string, "details"?: unknown } }`.
  Validações de payload retornam `400` com `code: "VALIDATION_ERROR"` e a lista de
  mensagens em `details`.
- Paginação (listas): `?page=1&pageSize=20`; filtros por query; ordenação `?sort=`.
- IDs são strings (cuid). A autorização é sempre validada no backend.
- **Segurança:** headers HTTP via Helmet; CORS restrito a `CORS_ORIGIN`; login com
  limite de tentativas falhas por IP + e-mail (`AUTH_LOGIN_MAX_ATTEMPTS`) que responde
  `429 TOO_MANY_REQUESTS`; reuso de refresh token já rotacionado revoga todas as sessões
  do usuário. Em produção os segredos JWT exigem ≥ 32 caracteres e devem ser distintos.

## Implementado (Fases 1–2)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/health` | público | Status da API e do banco. |
| POST | `/auth/login` | público | Login; devolve `accessToken` + `user`; seta cookie de refresh (`429` após excesso de falhas). |
| POST | `/auth/refresh` | público (cookie) | Rotaciona refresh e emite novo access token (reuso revoga a sessão). |
| POST | `/auth/logout` | público (cookie) | Revoga refresh e limpa cookie. |
| GET | `/auth/me` | Bearer | Usuário autenticado (inclui `mustChangePassword`). |
| POST | `/auth/change-password` | Bearer | Troca a própria senha (`{ currentPassword, newPassword }`); limpa a senha provisória, revoga as sessões e devolve novos tokens. |
| GET | `/professionals` | ADMIN/MANAGER | Lista paginada + `stats` (certificações, expirando, vencidas, roadmap aberto). Filtros: `search, active, role, professionalType, seniority`. |
| GET | `/professionals/:id` | autenticado (CONSULTANT só o próprio) | Detalhe com `stats`. |
| POST | `/professionals` | ADMIN/MANAGER | Cria. `role`/`password`/`mustChangePassword` apenas ADMIN; com senha, `mustChangePassword` assume `true` por padrão. |
| PUT | `/professionals/:id` | ADMIN/MANAGER | Atualiza. |
| PATCH | `/professionals/:id/status` | ADMIN/MANAGER | Ativa/desativa (`{ active }`). |
| DELETE | `/professionals/:id` | ADMIN/MANAGER | Desativação (soft delete). |
| GET | `/vendors` | autenticado | Lista paginada + `_count` (tecnologias, certificações). |
| GET/POST/PUT/PATCH·status/DELETE | `/vendors[...]` | escrita ADMIN/MANAGER | CRUD de fabricantes. |
| GET/POST/PUT/PATCH·status/DELETE | `/technologies[...]` | escrita ADMIN/MANAGER | CRUD; valida fabricante. |
| GET/POST/PUT/PATCH·status/DELETE | `/certifications[...]` | escrita ADMIN/MANAGER | CRUD; valida fabricante e tecnologia do fabricante. |

Convenções de lista: `?page=&pageSize=&search=&sort=&order=asc|desc` → `{ data, meta }`.
Toda escrita é auditada em `audit_logs`.

### Relacionamentos (Fase 3)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/professionals/:id/certifications` | autenticado (CONSULTANT só o próprio) | Certificações do profissional com `status` e `daysRemaining` calculados. |
| POST | `/professionals/:id/certifications` | ADMIN/MANAGER · CONSULTANT (só o próprio) | Vincula certificação. Bloqueia vínculo em vigor duplicado (409) e datas incoerentes (400). Com `renew: true` encerra o registro vigente na véspera da nova obtenção (nova linha, histórico preservado). |
| PUT | `/professionals/:id/certifications/:recordId` | ADMIN/MANAGER · CONSULTANT (só o próprio) | Atualiza o registro (datas, nº do certificado, comprovação). Revalida a duplicidade em vigor. |
| DELETE | `/professionals/:id/certifications/:recordId` | ADMIN/MANAGER · CONSULTANT (só o próprio) | Remove o vínculo. |
| POST | `/professionals/:id/certifications/:recordId/attachment` | ADMIN/MANAGER · CONSULTANT (só o próprio) | Anexa/substitui o comprovante em PDF (`multipart/form-data`, campo `file`). Valida tipo e assinatura `%PDF-` e o limite `MAX_UPLOAD_MB` (400 se inválido). |
| GET | `/professionals/:id/certifications/:recordId/attachment` | ADMIN/MANAGER · CONSULTANT (só o próprio) | Baixa o comprovante (rota autenticada; `Content-Type: application/pdf`, `Content-Disposition: inline`). `404` se não houver anexo. |
| DELETE | `/professionals/:id/certifications/:recordId/attachment` | ADMIN/MANAGER · CONSULTANT (só o próprio) | Remove o anexo (204). |
| GET | `/professionals/:id/technologies` | autenticado (escopo do consultor) | Tecnologias derivadas das certificações + melhor status. |
| GET | `/professionals/:id/history` | autenticado (escopo do consultor) | Últimas 100 alterações auditadas do profissional. |

> `:recordId` é o id do registro em `professional_certifications` (o vínculo), não o id do catálogo.

### Roadmap (Fase 4)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/roadmap` | ADMIN/MANAGER | Lista paginada com filtros: `search, professionalId, vendorId, technologyId, certificationId, type, priority, status, from, to, overdue` (`overdue` combina com o intervalo de datas). |
| GET | `/roadmap/kanban` | ADMIN/MANAGER | Itens agrupados por status. |
| GET | `/roadmap/timeline` | ADMIN/MANAGER | Itens ordenados por início/prazo (até 300). |
| GET | `/roadmap/:id` | ADMIN/MANAGER | Detalhe. |
| POST | `/roadmap` | ADMIN/MANAGER | Cria. Deriva a tecnologia da certificação quando aplicável; valida prazo ≥ início. |
| PUT | `/roadmap/:id` | ADMIN/MANAGER | Atualiza. |
| PATCH | `/roadmap/:id/status` | ADMIN/MANAGER | Move no Kanban; `COMPLETED` define `completedAt`. |
| DELETE | `/roadmap/:id` | ADMIN/MANAGER | Remove. |
| GET | `/professionals/:id/roadmap` | autenticado (escopo do consultor) | Roadmap do profissional (aba do perfil). |

Cada item retorna `isOverdue`, `daysToDue` e `hasAttachment` calculados no backend.

#### Roadmap do profissional — autoatendimento (D-026)

Rotas aninhadas usadas pela aba Roadmap do perfil. ADMIN/MANAGER em qualquer profissional;
CONSULTANT **só no próprio** (`403` em `:id` de terceiros). O `professionalId` é fixado pela
rota — não é possível mover o item para outro profissional.

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/professionals/:id/roadmap` | ADMIN/MANAGER · CONSULTANT (só o próprio) | Cria item de roadmap. |
| PUT | `/professionals/:id/roadmap/:itemId` | ADMIN/MANAGER · CONSULTANT (só o próprio) | Atualiza o item (não troca de dono). |
| PATCH | `/professionals/:id/roadmap/:itemId/status` | ADMIN/MANAGER · CONSULTANT (só o próprio) | Move o status; `COMPLETED` define `completedAt`. |
| DELETE | `/professionals/:id/roadmap/:itemId` | ADMIN/MANAGER · CONSULTANT (só o próprio) | Remove o item (e o anexo). |
| POST | `/professionals/:id/roadmap/:itemId/attachment` | ADMIN/MANAGER · CONSULTANT (só o próprio) | Anexa/substitui o comprovante em PDF (`multipart/form-data`, campo `file`). Valida tipo, assinatura `%PDF-` e `MAX_UPLOAD_MB` (400 se inválido). |
| GET | `/professionals/:id/roadmap/:itemId/attachment` | ADMIN/MANAGER · CONSULTANT (só o próprio) | Baixa o comprovante (rota autenticada; `Content-Type: application/pdf`, `Content-Disposition: inline`). `404` se não houver anexo. |
| DELETE | `/professionals/:id/roadmap/:itemId/attachment` | ADMIN/MANAGER · CONSULTANT (só o próprio) | Remove o anexo (204). |

### Dashboard (Fase 5)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/dashboard` | ADMIN/MANAGER | Endpoint único e otimizado com todos os agregados: `cards`, `certificationStatus`, `upcomingExpirations`, `roadmap` (30d/31–90d/6 meses/atrasados), `alerts` e `coverage`. |

> As rotas separadas (`/dashboard/expirations`, `/coverage`, `/alerts`) foram consolidadas em uma única chamada para evitar múltiplas idas ao servidor (D-011). Toda a cobertura é calculada pelo `CoverageService` (D-010).

### Relatórios (Fase 6)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/reports/certifications` | ADMIN/MANAGER | Todos os profissionais e certificações, com status e dias restantes. |
| GET | `/reports/expirations` | ADMIN/MANAGER | Vencimentos com faixas: Vencida, Até 30, 31–60, 61–90, Acima de 90 dias. |
| GET | `/reports/roadmap` | ADMIN/MANAGER | Situação por item: Atrasado, Próximo, Backlog, Concluído, Cancelado. |
| GET | `/reports/vendors` | ADMIN/MANAGER | Por fabricante: tecnologias, certificações, profissionais certificados e cobertura. |
| GET | `/reports/consultants` | ADMIN/MANAGER | Painel de consultores (D-028): um item por CONSULTANT ativo com `stats` (total/abertos/concluídos/cancelados/atrasados) e a lista resumida dos itens de roadmap (sem `format`/filtros; não é CSV). |

Parâmetros comuns (exceto `/reports/consultants`): `format=json|csv` (padrão `json`), `professionalId`, `vendorId`, `technologyId`.
O JSON devolve `{ key, title, columns, rows, summary, generatedAt }`; com `format=csv`
retorna `text/csv` (UTF-8 com BOM, separador `;`) como download. A mesma estrutura de
colunas/linhas permite adicionar um exportador XLSX no futuro sem alterar a lógica (D-013).
Células de texto que começariam com fórmula (`=`, `+`, `@`) são prefixadas com `'` para
evitar CSV injection ao abrir a planilha (D-018).

### Importação (Fase 7)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/imports/:type/preview` | ADMIN/MANAGER | Valida o CSV e devolve prévia linha a linha (sem gravar nada). Responde `200`. |
| POST | `/imports/:type/commit` | ADMIN/MANAGER | Revalida e importa as linhas válidas; devolve resumo e erros restantes. |

`:type` = `professionals` (colunas `name,email,position,professional_type,seniority`)
ou `certifications` (`professional_email,vendor,certification,obtained_at,expires_at,certificate_number`).
Upload `multipart/form-data` no campo `file` (≤ 2 MB, ≤ 1000 linhas). Aceita separador
`,` ou `;` (auto-detectado) e datas `YYYY-MM-DD` ou `DD/MM/YYYY` — formatos ambíguos e
datas de calendário inexistentes (ex.: `2026-02-30`) são rejeitados como erro de linha.
Os cabeçalhos aceitam aliases em português (ex.: `nome`, `fabricante`, `senioridade`).

> O commit **nunca** confia na prévia: revalida o arquivo do zero (D-014). Nada é
> importado sem que a validação tenha sido exibida ao usuário. Cada linha é gravada com
> sua auditoria na mesma transação; linhas com referência removida entre a prévia e a
> confirmação aparecem no relatório de erros.

### Tec News (D-020)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/news` | autenticado | Lista paginada de novidades. Filtros: `search, vendorId, technologyId, sourceId, kind, unread, saved, pinned, from, to, sort, order`. Cada item traz `read`/`saved` **do usuário** e a relevância (`relevanceScore`, `relevanceFocus`, `relevanceNote`); `sort=relevanceScore` ordena por relevância. |
| GET | `/news/summary` | autenticado | Contadores do usuário: `{ total, pinned, unread, saved }`. |
| GET | `/news/digest` | autenticado | Último **resumo inteligente** (destaques). Devolve `{ aiEnabled, autoEnabled, digest }`; `digest` é `null` se ainda não houver. |
| POST | `/news/digest` | ADMIN/MANAGER | Gera um novo resumo agora (foco em funcionalidades e certificações). Sem IA configurada → `503`. |
| GET | `/news/:id` | autenticado | Detalhe da novidade. |
| POST | `/news` | ADMIN/MANAGER | Curadoria manual (título, link, resumo, autor, tipo, fabricante/tecnologia). Link duplicado → `409`. |
| PUT | `/news/:id` | ADMIN/MANAGER | Atualiza a novidade. |
| PATCH | `/news/:id/pin` | ADMIN/MANAGER | Fixa/desfixa como destaque (`{ pinned }`). |
| PATCH | `/news/:id/read` | autenticado | Marca lida/não lida (`{ read }`), por usuário. |
| PATCH | `/news/:id/save` | autenticado | Salva/remove dos salvos (`{ saved }`), por usuário. |
| DELETE | `/news/:id` | ADMIN/MANAGER | Soft delete (`hidden`). |
| GET | `/news/sources` | ADMIN/MANAGER | Lista as fontes de feed (paginada; `search, vendorId, active`). |
| POST | `/news/sources` | ADMIN/MANAGER | Cadastra fonte (`vendorId, technologyId?, name, url?, connectorType?, fetchIntervalMinutes?, active?`). URL obrigatória fora do tipo `MANUAL`. |
| GET | `/news/sources/:id` | ADMIN/MANAGER | Detalhe da fonte. |
| PUT | `/news/sources/:id` | ADMIN/MANAGER | Atualiza a fonte. |
| PATCH | `/news/sources/:id/status` | ADMIN/MANAGER | Ativa/desativa (`{ active }`). |
| DELETE | `/news/sources/:id` | ADMIN/MANAGER | Desativação (soft). |
| POST | `/news/sources/:id/sync` | ADMIN/MANAGER | Sincroniza **uma** fonte agora. |
| POST | `/news/sync` | ADMIN/MANAGER | Sincroniza todas as fontes ativas; devolve `{ sources, fetched, created, updated, errors }`. |

> A ordem de registro preserva `news/sources` antes de `news/digest` e `news/:id`. A ingestão
> exige saída HTTPS para os fabricantes e é **opt-in** (`NEWS_SYNC_ENABLED`); o parser é
> tolerante e uma fonte com erro não interrompe as demais (o motivo fica em `last_error`).
> O escopo inicial cobre Red Hat, Nutanix, Veeam, ExaGrid e SUSE (fontes já cadastradas no
> seed).
>
> **Resumo inteligente (D-022):** a relevância heurística (`relevanceScore`) é sempre
> calculada. O `digest` é **opt-in** (`NEWS_DIGEST_ENABLED` + IA configurada via
> `AI_ENABLED`/`AI_API_KEY`): é gerado ao fim de uma sincronização com novidades novas e,
> sob demanda, por `POST /news/digest`. Quando a IA está desligada, o endpoint `POST`
> responde `503` e o Tec News continua funcionando com a ordenação por relevância.

### Releases (D-021)

Todas as rotas são restritas a **ADMIN/MANAGER**.

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/releases` | Lista paginada (mais recentes primeiro). Filtros: `search` (versão/título), `current`. |
| GET | `/releases/:id` | Detalhe, com itens ordenados. |
| POST | `/releases` | Cria release (`version` `X.Y.Z` única, `title`, `summary?`, `releasedAt`, `current?`, `items[]`). Versão duplicada → `409`; formato inválido → `400`. |
| PUT | `/releases/:id` | Atualiza. Se `items` for enviado, **substitui** a lista de itens. |
| PATCH | `/releases/:id/current` | Marca como versão atual (desmarca as demais). |
| DELETE | `/releases/:id` | Soft delete (`hidden`). |

> Cada item tem `category` (`FEATURE|IMPROVEMENT|FIX|SECURITY|INFRA|OTHER`) e
> `description`. Só pode haver uma release com `current = true`.

### Configurações (D-023)

Todas as rotas são restritas a **ADMIN** (a chave de IA é um segredo e nunca é devolvida).

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/settings/ai` | Configuração efetiva de IA: `{ enabled, baseUrl, model, timeoutMs, apiKeySet, apiKeySource, digestEnabled, digestWindowDays, digestMaxItems }`. Nunca inclui a chave. |
| PUT | `/settings/ai` | Atualiza os campos (parciais). `apiKey` grava/rotaciona a chave (cifrada); `clearApiKey: true` remove a chave salva. |
| POST | `/settings/ai/test` | Testa a conexão (`baseUrl`, `model`, `timeoutMs`, `apiKey` opcionais — o ausente usa a config efetiva). `200` em sucesso; `400` com o motivo em falha. |

> A resolução é **banco sobrepõe ambiente**: o que foi salvo pela interface vence; o que não
> foi salvo cai em `AI_*`/`NEWS_DIGEST_*`. A chave é cifrada em repouso
> (`SETTINGS_ENCRYPTION_KEY`, com fallback para o segredo de acesso do JWT).

### Configuração de envio de e-mail (D-030)

Restrito a **ADMIN**. Guarda o transporte SMTP/Graph usado pelos Relatórios de Chamados. As
credenciais (senha SMTP, client secret do Graph) são **cifradas em repouso** e nunca devolvidas
(a resposta traz `smtpPasswordSet`/`graphClientSecretSet`).

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/settings/email` | Configuração efetiva (sem segredos): `enabled`, `transport` (`SMTP|GRAPH`), remetente, SMTP (`host`/`port`/`secure`/`user`) e Graph (`tenantId`/`clientId`). |
| PUT | `/settings/email` | Atualiza campos (parciais). `smtpPassword`/`graphClientSecret` gravam cifrado; `clearSmtpPassword`/`clearGraphClientSecret` removem. |
| POST | `/settings/email/test` | Envia um e-mail de teste (`to` opcional; ausente usa o remetente). `200` em sucesso; `503`/`400` com o motivo. |

### Identidade Visual (D-030)

Restrito a **ADMIN**. Nome, cores, logo e contatos usados nos Relatórios de Chamados.

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/settings/branding` | `{ companyName, primaryColor, secondaryColor, logoDataUrl, contactLine, website }`. |
| PUT | `/settings/branding` | Atualiza (parcial). `logoDataUrl` grava a logo (data URL); `clearLogo` remove. Cores em `#RRGGBB`. |

### Configuração da integração Zoho Desk (D-030)

Restrito a **ADMIN** e exige `TICKETS_ENABLED=true` (senão `404`). Guarda a configuração da
integração: data center, credenciais, escopos, campo de tecnologia, origem do cliente
(Account/Contact), status "fechado" e frequência de sincronização. Client Secret e Refresh
Token são **cifrados em repouso** (`SETTINGS_ENCRYPTION_KEY`, com fallback para o segredo do
JWT) e **nunca** devolvidos (a resposta traz `clientSecretSet`/`refreshTokenSet`). Resolução
**banco sobrepõe ambiente** (`ZOHO_*`).

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/settings/zoho` | Configuração efetiva (sem segredos): `dataCenter`, `clientId`, `orgId`, `clientSecretSet`/`refreshTokenSet`, `redirectUri` (derivada), `apiBaseUrl`/`accountsBaseUrl` (derivados do data center), `scopes`, `technologyField`, `clientSource`, `closedStatuses`, `syncFrequency`, `syncEnabled`, `syncIntervalMinutes` e `configured`. |
| PUT | `/settings/zoho` | Atualiza campos (parciais). `clientSecret`/`refreshToken` gravam cifrado; `clearClientSecret`/`clearRefreshToken` removem. `dataCenter` ∈ `com|eu|in|au|cn|jp`; `syncFrequency` ∈ `MANUAL|HOURLY|SIX_HOURS|DAILY`. |
| POST | `/settings/zoho/test` | Testa a conexão (`GET /tickets?limit=1`); campos opcionais (`dataCenter`/`clientId`/`clientSecret`/`refreshToken`/`orgId`) sobrepõem a config efetiva. `200` em sucesso; `400` com o motivo detalhado (credencial, escopo, orgId ou domínio). |
| POST | `/settings/zoho/sync` | Sincroniza agora (equivalente a `POST /tickets/sync`). |
| GET | `/settings/zoho/sync-log` | Histórico das últimas 20 sincronizações (`at, status, fetched, created, updated, unmapped, errors`). |
| POST | `/settings/zoho/disconnect` | Apaga as credenciais salvas (volta a depender do ambiente, se houver). |
| GET | `/settings/zoho/auth-url` | (ADMIN) Devolve `{ url }` de consentimento do Zoho (escopos + `redirect_uri` + `state` de uso único, válido por 10 min). Exige Client ID e Secret já salvos. |
| GET | `/settings/zoho/callback` | **Público** (o navegador volta aqui do Zoho, sem token). Valida o `state`, troca o `code` pelo **Refresh Token** (cifrado e salvo) e redireciona a interface para `PUBLIC_WEB_URL/configuracoes?zoho=connected` (ou `...&warn=...`/`zoho=error&reason=...`). |

> Frequência `MANUAL` desliga o agendador; as demais ligam o sync periódico. "Conectar com
> Zoho" conclui o fluxo OAuth (Authorization Code, `access_type=offline`) e a interface relata
> o resultado; "Testar conexão" continua disponível a qualquer momento.

### Tickets — clientes e chamados (D-029)

Módulo do **espelho dos chamados do Zoho Desk** e das **Medições Mensais**. Fica **desligado
por padrão** (`TICKETS_ENABLED=false`): enquanto desligado, **todas** as rotas abaixo respondem
`404` (o módulo não se anuncia). Quando ligado, o acesso é restrito a **ADMIN/MANAGER** — o
CONSULTANT recebe `403`. Nesta fase o módulo é **somente leitura/CRUD interno**; o
espelhamento do Zoho entra na Fase 3.

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/clients` | ADMIN/MANAGER | Lista paginada de clientes (`{ data, meta }`). Filtros: `search`, `active`, `sort`, `order`. Cada item traz `_count.tickets`. |
| GET | `/clients/:id` | ADMIN/MANAGER | Detalhe do cliente. `404` se não existir. |
| POST | `/clients` | ADMIN/MANAGER | Cria (`name` obrigatório; `document`, `zohoAccountId`, `active?`). `document`/`zohoAccountId` duplicado → `409`. |
| PUT | `/clients/:id` | ADMIN/MANAGER | Atualiza (campos parciais). |
| PATCH | `/clients/:id/status` | ADMIN/MANAGER | Ativa/desativa (`{ active }`). |
| DELETE | `/clients/:id` | ADMIN/MANAGER | Desativação (soft delete, `204`). |
| GET | `/tickets` | ADMIN/MANAGER | Lista paginada de chamados espelhados. Filtros: `clientId`, `status`, `search` (título/número), `from`/`to` (**período por `close_date`**, ISO `YYYY-MM-DD`, inclusivo), `billable`, `sort`, `order`. Cada item traz `client { id, name }`. |
| GET | `/tickets/:id` | ADMIN/MANAGER | Detalhe do chamado. `404` se não existir. |

> `status` é **texto livre** (rótulo do Zoho). `close_date` é a data de referência da medição
> mensal. Toda escrita de cliente é auditada em `audit_logs` (`entity: "clients"`).

#### Espelhamento do Zoho Desk (Fases 3–4)

Integração **opt-in** e **somente leitura** no Zoho (`ZOHO_SYNC_ENABLED`; credenciais por
variável de ambiente **ou** pela tela de Configurações, cifradas — nunca devolvidas pela API
nem registradas em log). Requer `TICKETS_ENABLED=true`; as rotas abaixo são restritas a **ADMIN**.

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/tickets/sync` | Sincroniza agora (manual). Upsert idempotente por `zohoTicketId`, incremental por `modifiedTime`. Devolve o resumo `{ startedAt, finishedAt, fetched, created, updated, unmapped, errors, status }`. `503` quando o Zoho não está configurado. |
| GET | `/tickets/sync/status` | `{ syncEnabled, configured, lastRun }` (última execução: data, status e contagens). Nunca expõe credenciais. |
| GET | `/tickets/unmapped` | Lista paginada da fila de chamados **sem cliente mapeado** (payload cru preservado). |
| POST | `/tickets/unmapped/:id/link` | Vincula o chamado da fila a um cliente (`{ clientId }`): cria/atualiza o `Ticket`, remove da fila e audita. |

> Chamados cujo `accountId` não corresponde a nenhum `Client.zohoAccountId` vão para a fila de
> **não mapeados** (não se adivinha o cliente). O log de execução é auditado
> (`entity: "zoho_sync"`) e a última execução fica em `app_settings` (key `zoho_sync`).
>
> Por chamado espelhado, a sincronização também busca os **lançamentos de tempo**
> (`GET /tickets/{id}/timeEntries`), grava cada um em `time_entries` (minutos inteiros, agente,
> `executedTime`, `isBillable`) e recalcula `time_spent_minutes` como a **soma** (D-030). Os
> campos de conta/contato/departamento/responsável e a **tecnologia** (campo personalizado
> configurável em Configurações) também são preenchidos no `Ticket`.

#### Contratos de serviço (D-030)

Contratos do cliente (franquia, valores e política de saldo) que alimentam a **regra de
faturamento (B3)**. Requer `TICKETS_ENABLED=true`; acesso de **ADMIN/MANAGER**; escrita auditada.

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/contracts` | Lista paginada. Filtros: `clientId`, `active`, `search` (plano), `sort`, `order`. Cada item traz `client { id, name }`. |
| GET | `/contracts/:id` | Detalhe. `404` se não existir. |
| POST | `/contracts` | Cria (`clientId`, `planName`, `includedMinutes`, `monthlyValue`, `extraHourValue`, `balancePolicy` ∈ `EXPIRE|ACCUMULATE`, `startDate` `YYYY-MM-DD`, `endDate?`, `financeEmail?`, `active?`). Cliente inexistente → `404`; validação → `400`. |
| PUT | `/contracts/:id` | Atualiza (parcial). |
| PATCH | `/contracts/:id/status` | Ativa/desativa (`{ active }`). |
| DELETE | `/contracts/:id` | Desativação (soft delete, `204`). |

> A regra de faturamento (B3) é uma função pura (`computeBilling`): `adicionais =
> max(0, horas − franquia)`; `PADRÃO` se `adicionais = 0`, senão `COM HORAS ADICIONAIS`;
> `total = valor_mensal + adicionais × valor_hora`. Com `ACCUMULATE`, o saldo de meses
> anteriores (`carriedMinutes`) é somado à franquia; com `EXPIRE`, é ignorado.

#### Relatórios de Chamados (D-030)

Métricas (B2) por cliente/período + prévia, geração auditada e lista. Requer
`TICKETS_ENABLED=true`; **ADMIN/MANAGER**. Período por `year`+`month` OU `from`+`to`
(`YYYY-MM-DD`), interpretado em `BUSINESS_TIMEZONE`.

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/ticket-reports/preview` | Prévia: `metrics` (fechados por `closeDate`; abertos no período; abertos ao fim; horas por lançamento/`executedTime` em HH:MM; tempo médio de solução; horas e chamados por tecnologia) + `billing` (B3, quando há cliente+contrato) + `alerts` (fechado sem horas, sem tecnologia, cliente sem contrato). Sem período → `400`. |
| POST | `/ticket-reports` | Gera e registra o relatório em `generated_reports`: `clientId`, `type` ∈ `FINANCIAL|CLIENT`, período. Devolve `{ report, preview }`. |
| GET | `/ticket-reports` | Lista paginada dos relatórios gerados. Filtros: `clientId`, `type`, `from`/`to` (período), `sort`, `order`. |
| GET | `/ticket-reports/:id` | Detalhe do relatório gerado (inclui quem gerou). |
| GET | `/ticket-reports/financial/preview` | Prévia do **Relatório Financeiro** (e-mail): `{ subject, to, text, html, attachmentFileName }`. `400` se o cliente não tiver contrato. |
| GET | `/ticket-reports/financial/attachment.pdf` | PDF detalhado (chamados e horas) do Relatório Financeiro — `application/pdf`. |
| GET | `/ticket-reports/financial/eml` | Arquivo `.eml` (HTML+texto + PDF anexado) para download — `message/rfc822`. |
| POST | `/ticket-reports/financial/send` | Envia o e-mail (SMTP/Graph). Exige `confirm: true`. Registra em `generated_reports` (`sentAt`/`sentTo`). `400` sem confirmação/destinatário; `503` se o envio não estiver configurado. |
| GET | `/ticket-reports/client/preview` | Prévia (HTML) do **Relatório do Cliente** (**sem valores**): identidade visual, KPIs, barra de consumo da franquia, gráficos (SVG), campos editáveis (`highlights`/`recommendations` via query), tabela detalhada e rodapé. |
| GET | `/ticket-reports/client/pdf` | PDF A4 do Relatório do Cliente (cabeçalho e cabeçalho de tabela **repetidos**, rodapé `Página X de Y`, gráfico de tecnologias) — `application/pdf`. |

> Horas = soma dos **lançamentos** no período (`executedTime`). Fechados = `closeDate` no
> período; abertos ao fim = `closeDate` nulo com abertura antes do fim do período. O
> faturamento usa a regra B3 (ver Contratos).

#### Medições Mensais (Fase 4)

Consolida, por **cliente/mês**, os chamados faturados (`isBillable=true`, `close_date` no mês
interpretado em `BUSINESS_TIMEZONE`). A medição **FECHADA é imutável** (snapshot do
fechamento); reabertura é exclusiva de **ADMIN**, com justificativa auditada. Requer
`TICKETS_ENABLED=true`; acesso de ADMIN/MANAGER.

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/measurements` | ADMIN/MANAGER | Lista paginada. Filtros: `clientId`, `year`, `month`, `status`. Cada item traz totais, `slaPercentage` e `client`. |
| GET | `/measurements/:id` | ADMIN/MANAGER | Detalhe com `items` (snapshot dos chamados). `404` se não existir. |
| POST | `/measurements` | ADMIN/MANAGER | Gera/recalcula o **rascunho** (`{ clientId, year, month }`): recalcula os totais e substitui o snapshot. `409` se a medição já estiver fechada. |
| POST | `/measurements/:id/close` | ADMIN/MANAGER | Fecha (`closedById`/`closedAt`). `409` se já estiver fechada. Uma medição fechada não é recalculada. |
| POST | `/measurements/:id/reopen` | ADMIN | Reabre (`{ justification }`, obrigatória). `400` se não estiver fechada; a justificativa fica na auditoria. |
| GET | `/measurements/:id/export.csv` | ADMIN/MANAGER | Exporta a medição **fechada** em CSV (UTF-8 com BOM, separador `;`, mesmo formato dos Relatórios/D-018). `400` se não estiver fechada. |
| GET | `/measurements/:id/export.pdf` | ADMIN/MANAGER | Exporta a medição **fechada** em PDF: cabeçalho (cliente, CNPJ/NIF, período, totais), lista de chamados, **código de verificação** (hash) e data/usuário de fechamento. `400` se não estiver fechada. |

> Totais: `ticketCount`, `timeSpentMinutes`, `slaEvaluatedCount` (chamados com SLA avaliado) e
> `slaCompliantCount`; `slaPercentage = slaCompliantCount / slaEvaluatedCount` (null quando não
> há SLA avaliado).

### Exemplos

```bash
# login
curl -i -c cookies.txt -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@suporte.local","password":"Admin@123"}'

# me (com o access token retornado)
curl http://localhost:4000/api/v1/auth/me -H "Authorization: Bearer <token>"

# refresh (usa o cookie)
curl -b cookies.txt -c cookies.txt -X POST http://localhost:4000/api/v1/auth/refresh
```

## Planejado (próximas fases)

A Fase 7 concluiu as rotas de negócio do MVP e a Fase 8 foi de **QA**. Os módulos
**Tec News** (D-020), **Releases** (D-021) e o **resumo inteligente** do Tec News (D-022)
foram adicionados depois, com as rotas acima. Integrações futuras (fora do MVP): Zoho,
notificações (e-mail/Teams/Slack/WhatsApp) e scraping/monitoramento avançado de
fabricantes (a via RSS/Atom já está coberta pelo Tec News).

> As rotas planejadas serão implementadas nas Fases 2–7 e este documento será
> atualizado a cada fase (não deixar documentação desatualizada).
