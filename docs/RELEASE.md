# Deploy e releases — Suporte Skills

## Deploy padrão (por GIT) — VM Ubuntu (10.0.0.200)

A VM roda um **checkout git** do repositório em `/home/renato/suporte-skills`. O deploy é
padronizado por [`scripts/deploy.sh`](../scripts/deploy.sh):

```bash
cd /home/renato/suporte-skills
bash scripts/deploy.sh              # deploya main
bash scripts/deploy.sh v0.9.0       # (opcional) deploya uma tag especifica
```

Passos do script: `git fetch` → `git checkout -f <ref>` → **backup do banco** (dump via container)
→ `docker compose build api web` → `docker compose up -d` → **aguarda `GET /api/v1/health = 200`**
→ cria a **release do changelog** a partir de `scripts/releases/<APP_VERSION>.json` (best-effort).
Opções: `--skip-backup`, `--no-build`.

- **Nunca** rode `npm run seed` nem `scripts/acceptance.sh` na VM (dados reais) — valide com
  `scripts/smoke.sh` (não-destrutivo).
- `docker compose up -d` retorna **antes** da API ficar pronta — o script já espera o health (senão
  o nginx responde `502`).
- `.env`, `data/`, `certs/` e `backups/` estão no `.gitignore` — o `git checkout` **não** os altera.

## Preparo inicial do servidor (uma vez)

```bash
cd /home/renato/suporte-skills
git init && git remote add origin https://github.com/renatokavalcanti/suporte-skills.git
git fetch --tags origin && git checkout -f main   # .env/data/certs/backups permanecem
```

---

# Release — 0.9.8 (D-038) — indicador de ambiente (PRD/HML/DEV)

**Escopo:** a interface passa a **exibir o ambiente** (PRD/HML/DEV). **Sem migration.**

- **Backend:** `APP_ENVIRONMENT` (config + `GET /health` + log de boot).
- **Frontend:** `config/environment.ts`, `components/environment-badge.tsx` (cor por ambiente) no
  **topo** e no **Dashboard**.
- **Build/infra:** `docker-compose.yml` repassa `APP_ENVIRONMENT` à API e `VITE_APP_ENVIRONMENT` ao
  build da SPA (arg no `frontend/Dockerfile`).
- **Por ambiente:** `.env` do HML → `APP_ENVIRONMENT=HML`; `.env` do PRD (Azure) → `PRD`; local → `DEV`.
- **Testes:** backend **86/86**. **Aceite:** estado DEMO passa a **21 releases**.

**Deploy:** no HML (`deploy.sh`) e no PRD (`docker compose -f docker-compose.yml -f
docker-compose.cloud.yml up -d --build`). O `web` precisa ser **reconstruído** (o valor entra no
build da SPA). Valide com `bash scripts/smoke.sh`.

**Rollback:** HML → `git checkout -f f641f72`; PRD → mesmo commit.

---

# Release — 0.9.7 (D-037) — publicação na nuvem (Azure)

**Escopo:** ambiente de nuvem numa VM na Azure com **HTTPS real (Let's Encrypt)**. **Sem migration.**

- **Nuvem:** `docker-compose.cloud.yml` (override) + `Caddyfile` + `frontend/nginx.cloud.conf`
  + `.env.cloud.example`. O Caddy termina o TLS e faz o proxy HTTP para `web`; `db`/`api`/`web`
  não publicam porta no host.
- **On-prem:** **inalterado** (segue com `docker-compose.yml` e certificado autoassinado).
- **Guia:** [`docs/CLOUD.md`](./CLOUD.md).
- **Deploy (nuvem):** `docker compose -f docker-compose.yml -f docker-compose.cloud.yml up -d --build`.
- **Aceite:** estado DEMO passa a **20 releases**.

---

# Release — 0.9.6 (D-036) — testar e-mail antes de habilitar

**Escopo:** na tela **Configurações → Envio de e-mail**, o botão **"Enviar teste"** passa a usar os
valores preenchidos no formulário (sem salvar) e funciona **mesmo com o envio desabilitado** —
dá para validar SMTP/Graph antes de ligar o envio. **Sem migration.**

- **Backend:** `email-settings.service.ts` (`sendable` + `resolveWithOverrides`),
  `mailer.service.ts` (exige `sendable`), `TestEmailSettingsDto extends UpdateEmailSettingsDto`,
  `settings.controller.ts` (teste com overrides).
- **Frontend:** `email-settings-card.tsx` (teste envia o formulário; botão habilita pelo
  preenchimento) e `settings.service.ts`.
- **Testes:** backend **81/81** (+3). **Aceite:** estado DEMO passa a **19 releases**.

**Deploy:** `bash scripts/deploy.sh`. Sem migration. Valide com `bash scripts/smoke.sh`.

**Rollback:** `git checkout -f 897c91b && docker compose up -d --build` (897c91b = v0.9.5).

---

# Release — 0.9.5 (D-035) — detalhe do chamado e re-associação

**Escopo:** na lista de **Tickets**, clicar no chamado abre um **modal** com os dados + os
**lançamentos de tempo** (data, técnico, horas, descrição, faturável) e o **total**; o **ADMIN**
pode **trocar o cliente** de um chamado mapeado, **desassociá-lo** (volta à fila de não mapeados) e
**reimportar as horas** daquele chamado. **Sem migration**.

- **Backend:** `tickets.service.ts` (`GET /tickets/:id` com `timeEntries`),
  `zoho-sync.service.ts` (`reassignTicket`, `unlinkTicket`, `refreshTicketTimeEntries`),
  `tickets.controller.ts` (`PATCH /tickets/:id/client`, `POST /tickets/:id/unlink`,
  `POST /tickets/:id/refresh-time-entries`). **ADMIN**; tudo auditado.
- **Frontend:** `features/tickets/ticket-detail-dialog.tsx` + linha clicável em `tickets-page.tsx`.
- **Testes:** backend **78/78** (+4). **Aceite:** estado DEMO passa a **18 releases**.

**Deploy:** `bash scripts/deploy.sh`. Sem migration. Valide com `bash scripts/smoke.sh`.

**Rollback:** `git checkout -f 1d602be && docker compose up -d --build` (1d602be = v0.9.4).

---

# Release — 0.9.4 (D-034) — sincronização de chamados

**Escopo:** corrige o espelhamento dos chamados do Zoho Desk. A **listagem** `GET /tickets` **não
devolve `modifiedTime`**, então o watermark ficava sempre nulo e a sincronização relia sempre os
primeiros **200** chamados (a base tem **611**). Agora a sincronização percorre a listagem por
**cursor de offset** (persistido em `app_settings.zoho_sync.cursorFrom`, reiniciado ao chegar ao
fim), busca os **lançamentos de tempo em paralelo** (concorrência 4) e o teto por execução sobe de
200 para **1000**. O **nginx** passa a aguardar **300 s** na rota `/api/` (antes 60 s), eliminando
o **504** que o navegador mostrava enquanto o backend concluía. **Sem migration** (o cursor é
JSON em `app_settings`). **Síncrono** (o `POST` continua devolvendo o resumo).

- **Backend:** `zoho-sync.service.ts` (cursor `cursorFrom`/`cursorComplete` + `mapWithConcurrency`),
  `config/configuration.ts` e `zoho-settings.service.ts` (`maxTicketsPerRun` 1000).
- **nginx:** `proxy_read_timeout`/`proxy_send_timeout` 300 s em `frontend/nginx.conf`.
- **Testes:** backend **74/74** (novo teste de avanço de cursor).
- **Aceite:** estado DEMO passa a **17 releases**.

**Deploy:** `bash scripts/deploy.sh` (a SPA/nginx é reconstruída). Sem migration. Depois do deploy,
rode **"Sincronizar agora"** (ou `POST /tickets/sync`); a base será varrida ao longo de poucas
execuções (o cursor avança a cada uma). Valide com `bash scripts/smoke.sh`.

**Rollback:** `git checkout -f 7e897d6 && docker compose up -d --build` (7e897d6 = v0.9.3).

---

# Release — 0.9.3 (D-033) — menu lateral em submenus

**Escopo:** agrupa itens relacionados do menu lateral em **submenus retráteis** — **"Catálogo"**
(Profissionais, Fabricantes, Tecnologias, Certificações) e **"GSS Qualidade"** (Clientes, Tickets,
Medições, Contratos, Relatórios de Chamados). **Somente frontend** — sem migration nem API.

- **Frontend:** `layouts/navigation.ts` (tipo `NavGroup`/`NavEntry`, helper `isNavGroup`,
  `visibleNavItems` filtrando por papel e descartando grupo vazio) e `layouts/sidebar.tsx`
  (grupo retrátil com chevron/`aria-expanded`, expande sozinho na rota ativa, mantém o estado;
  drawer mobile igual).
- **Testes:** sem mudança de API; `typecheck` e `build` limpos. Correção no aceite: **contagem de
  releases do estado DEMO (13 → 16)**, defasada em relação ao seed.
- **Controller:** nenhum. Sem `app_settings`, sem migration.

**Deploy:** `bash scripts/deploy.sh` (cria a release `0.9.3` a partir de
`scripts/releases/0.9.3.json`). Sem migration. Validar com `bash scripts/smoke.sh`.

**Rollback:** `git checkout -f 20c0bad && docker compose up -d --build` (20c0bad = v0.9.2).

---

# Release — 0.9.2 (D-032) — lançamentos de tempo

**Escopo:** corrige a leitura dos **lançamentos de tempo** do Zoho Desk (endpoint
`/tickets/{id}/timeEntry`, **singular**), espelha os lançamentos ao **vincular pela fila** e
adiciona a ação **"Atualizar horas"** (`POST /tickets/sync/time-entries`) para reimportar os
chamados já espelhados. **Aditivo** — sem migration.

- **Backend:** endpoint singular em `zoho-client.service.ts`; `linkRow` chama `afterTicketWrite`;
  `refreshTimeEntries` + rota `POST /tickets/sync/time-entries`; `ownerName` via `GET /agents/{id}`.
- **Frontend:** botão **"Atualizar horas"** na tela de Tickets (ADMIN).
- **Testes:** backend **73/73**; aceite bloco **11l** (total **233**).

**Deploy:** `bash scripts/deploy.sh` (ou `bash scripts/deploy.sh v0.9.2`). Sem migration. Depois do
deploy, rode **"Atualizar horas"** (ou `POST /tickets/sync/time-entries`) para **backfill** dos
chamados já espelhados.

**Rollback:** `git checkout -f v0.9.1 && docker compose up -d --build`.

---

# Release — 0.9.1 (D-031) — fila de não mapeados

**Escopo:** vínculo em lote na fila `unmapped_tickets` (por conta ou por seleção), **auto-limpeza**
ao mapear e **nome da conta** na fila. **Aditivo** — sem migration nem modelo novo.

- **Backend:** `GET /tickets/unmapped/groups`, `POST /tickets/unmapped/link`; `linkRow`
  reaproveitado pelo vínculo individual; auto-limpeza no sync; `getAccountName`
  (`GET /accounts/{id}`) com cache por execução.
- **Frontend:** `unmapped-dialog` com seletor de destino, **"Vincular todos (N)"** por conta e
  **"Vincular selecionados (k)"**.
- **Testes:** backend **69/69**; aceite bloco **11k** (total **231**).

**Deploy:** `bash scripts/deploy.sh` (ou `bash scripts/deploy.sh v0.9.1`). Sem migration; a
release do changelog é criada a partir de `scripts/releases/0.9.1.json`.

**Rollback:** `git checkout -f v0.9.0 && docker compose up -d --build` (as rotas novas somem;
nenhum dado é afetado).

---

# Release — Módulo Tickets (v0.8.0, D-029)

Runbook do release **controlado** do módulo Tickets (espelho do Zoho Desk + Medições
Mensais). O módulo nasce **desligado** (`TICKETS_ENABLED=false`) e é ligado só aqui. Siga na
ordem; cada passo tem verificação e rollback.

> **Autorização:** passos que tocam a **VM (10.0.0.200)** ou o **Zoho real** exigem o "ok" do
> responsável. O restante pode ser ensaiado localmente.

## 0. Pré-requisitos

- Release marcado: `backend/prisma/seed.ts` inclui a release `0.8.0` (current) e
  `frontend/src/config/version.ts` mostra `0.8.0`.
- `docker compose` e os scripts (`scripts/backup-db.sh`, `scripts/smoke.sh`) disponíveis.
- Estado estável de partida: `v0.7.2` / tag `tickets-fase-7`.

## 1. Ensaio em cópia do banco (sem produção)

Garanta que todas as migrations aplicam **do zero** e que nada quebra com dados reais.

```bash
# 1a. Copie o dump de produção mais recente para um ambiente de ensaio e restaure nele.
bash scripts/backup-db.sh                       # gera backups/suporte_skills_<data>.sql
psql -U suporte -h <host-ensaio> -d suporte_skills < backups/<arquivo>.sql

# 1b. Suba a stack de ensaio apontando para a cópia e aplique as migrations (só CREATE, aditivas).
docker compose -f docker-compose.ensaio.yml up -d --build
docker compose exec api npx prisma migrate deploy
```

- [ ] `migrate deploy` aplica **sem erro** `add_tickets_clients` → `unmapped_tickets` →
      `monthly_measurements` (todas aditivas; nenhuma altera/remove dados existentes).
- [ ] `npm run typecheck` / `npm run build` (backend e frontend) limpos.

## 2. Backup pré-deploy (obrigatório antes de tocar produção)

```bash
bash scripts/backup-db.sh      # informe/arquive o arquivo gerado
```

- [ ] Dump salvo e arquivado (guarde o caminho para o rollback).

## 3. Deploy em homologação (`TICKETS_ENABLED=false`)

```bash
git checkout tickets-fase-7      # ou o commit que fecha a Fase 7
docker compose build && docker compose up -d
docker compose exec api npx prisma migrate deploy
bash scripts/smoke.sh            # NÃO destrutivo
```

- [ ] `smoke.sh` verde (o bloco de Tickets aparece como `[SKIP]` — módulo desligado).
- [ ] Nenhuma rota de negócio regrediu.

## 4. Ativar o módulo (backend) + a SPA, em homologação

1. `TICKETS_ENABLED=true` no `.env` do backend (e redeploy do `api`).
2. `VITE_TICKETS_ENABLED=true` para o build da SPA e **rebuild da `web`**
   (`docker compose build --build-arg VITE_TICKETS_ENABLED=true web` — o compose já repassa
   `${VITE_TICKETS_ENABLED}`).
3. Rode o smoke novamente: o bloco de Tickets passa a executar (leituras + RBAC).

- [ ] Menu **Clientes / Tickets / Medições** aparece para ADMIN/MANAGER (e não para CONSULTANT).
- [ ] `GET /api/v1/clients`, `/tickets`, `/measurements` respondem `200` para ADMIN.
- [ ] CONSULTANT recebe `403` no módulo.

## 5. Piloto com 1 cliente (sem sync ainda)

Escolha um cliente real e cadastre-o com o **id da conta do Zoho**.

1. **Clientes → Novo cliente**: preencha nome, CNPJ/NIF e **Conta Zoho**
   (`zohoAccountId`) do cliente piloto.
2. Com o sync ainda desligado, valide o fluxo interno: **Medições → Gerar medição**
   (cliente + mês) com dados de teste; fechar; exportar CSV/PDF; reabrir.

- [ ] Cliente piloto criado e visível.
- [ ] Medição gera/fecha/exporta; reabertura só por ADMIN.

## 6. Habilitar a sincronização com o Zoho (piloto)

Configure as credenciais **só no servidor** (nunca no repositório) e ligue o sync:
`ZOHO_SYNC_ENABLED=true`, `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`,
`ZOHO_ORG_ID`. Redeploy do `api`.

1. **Tickets → Sincronizar agora** (ADMIN) — usa o Zoho em **somente leitura**.
2. Confira o resumo (`created/updated/unmapped`) e a fila **Não mapeados**.

- [ ] Sync cria/atualiza chamados; **2ª execução cria 0** (idempotente).
- [ ] Chamados do cliente piloto vinculam automaticamente (conta mapeada).
- [ ] Chamados sem cliente caem na fila e podem ser **vinculados manualmente**.
- [ ] `GET /tickets/sync/status` mostra `configured: true` e a última execução.

## 7. Fechar o release

- [ ] Marcar `0.8.0` como versão atual em **Releases** (já vem do seed; ajuste se o ambiente
      tem dados reais e não rodou o seed).
- [ ] Confirmar o rodapé da SPA em `0.8.0`.
- [ ] Tag Git: `git tag v0.8.0` (ou `git tag -a v0.8.0 -m "Módulo Tickets"`).

## Rollback (testado)

Ordem: primeiro **desligar por flag** (efeito imediato, sem tocar em dados); só restaurar o
banco se realmente necessário.

1. **Desligar o módulo (imediato, reversível):**
   `TICKETS_ENABLED=false` (+ `ZOHO_SYNC_ENABLED=false`) e redeploy do `api`. As rotas passam a
   responder `404` e a SPA some o menu (rebuild com `VITE_TICKETS_ENABLED=false`).
   → **Validação:** `bash scripts/smoke.sh` verde com o bloco de Tickets em `[SKIP]`.

2. **Reverter o código:**
   `git checkout v0.7.2` (ou `git revert` dos commits) e `docker compose up -d --build`.

3. **Reverter o banco (manual; não há "down" no Prisma):**
   - Preferir **restaurar o dump pré-deploy** (passo 2):
     `docker compose exec -T db psql -U suporte -d suporte_skills < backups/<arquivo>.sql`
   - Ou, seletivamente, `database/rollbacks/fase4_down.sql` → `fase3_down.sql` → `fase1_down.sql`
     (nesta ordem: itens → medições → enum → fila → tickets → clientes).
   - Em ambiente compartilhado, se a migration já foi aplicada e você só quer ignorá-la:
     `npx prisma migrate resolve --rolled-back <nome_da_migration>`.

4. **Validação pós-rollback:** `bash scripts/smoke.sh` verde e um login de ADMIN conferido.

> **Dados espelhados** (tabela `tickets`) podem ser removidos por data se necessário; **nunca**
> apague `clients` — os clientes são cadastro real.

## Referências

- Decisão: `docs/DECISIONS.md` (D-029). Banco: `docs/DATABASE.md`. API: `docs/API.md`.
- QA (bloco 11i): `docs/QA.md`. Scripts: `scripts/smoke.sh`, `scripts/acceptance.sh`,
  `scripts/backup-db.sh`. Rollbacks: `database/rollbacks/`.

---

# Release — Módulo Chamados (v0.9.0, D-030)

Release da **integração Zoho configurável** + **Relatórios de Chamados**, sobre a base do módulo
Tickets (D-029). Módulo **desligado por padrão**; passos na VM/Zoho real exigem autorização.

## Pré-requisitos
- Release `0.9.0` marcada (`backend/prisma/seed.ts` current + `frontend/src/config/version.ts`).
- Migração `20261013172326_add_contracts_time_entries_reports` (aditiva: só `CREATE`).

## Deploy
1. Backup pré-deploy: `bash scripts/backup-db.sh`.
2. `docker compose exec api npx prisma migrate deploy` (aditiva — não altera dados existentes).
3. `docker compose build && docker compose up -d` com `TICKETS_ENABLED=true` e
   `VITE_TICKETS_ENABLED=true` (build arg do SPA, como no release anterior).
4. `bash scripts/smoke.sh` verde — agora inclui Contratos, Config do Zoho/e-mail/identidade e a prévia.

## Configuração (ADMIN, pela interface)
- **Configurações > Integração Zoho Desk**: data center, Client ID/Secret e orgId → **Conectar com
  Zoho** (OAuth) → **Testar conexão** → **Sincronizar agora**.
- **Configurações > Envio de e-mail**: SMTP ou Microsoft Graph + "Enviar teste".
- **Configurações > Identidade Visual**: nome, cores e logo (do Relatório do Cliente).
- **Contratos**: franquia/valores/política de saldo por cliente.

## Rollback
1. **Flag off:** `TICKETS_ENABLED=false` + rebuild com `VITE_TICKETS_ENABLED=false` (404 + menu some).
2. **Código:** `git checkout v0.8.0 && docker compose up -d --build`.
3. **Banco:** preferir restaurar o dump pré-deploy; ou `database/rollbacks/chamados_fase1_down.sql`
   (dropa `generated_reports`/`time_entries`/`contracts` + colunas novas de `tickets`).
4. **Validar:** `bash scripts/smoke.sh` verde.

## Referências (Chamados)
- Decisão: `docs/DECISIONS.md` (D-030). Banco: `docs/DATABASE.md`. API: `docs/API.md`.
- QA (bloco 11j): `docs/QA.md`.
