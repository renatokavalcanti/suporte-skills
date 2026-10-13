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
