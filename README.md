# Suporte Skills

**Technical Capability Management** — plataforma interna da Suporte Informática
Soluções Ltda. para gerir competências técnicas, certificações, treinamentos e o
roadmap técnico da equipe.

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS + TanStack Query +
  React Router + React Hook Form/Zod.
- **Backend:** NestJS + TypeScript + Prisma.
- **Banco:** PostgreSQL 16.
- **Infra:** Docker + Docker Compose.

## Pré-requisitos

- Docker Desktop (com `docker compose`).
- Opcional para desenvolvimento local sem Docker: Node.js 20+ e PostgreSQL.

## Subindo com Docker (recomendado)

```bash
cp .env.example .env              # ajuste segredos se desejar
bash scripts/gen-certs.sh <IP>    # certificado TLS autoassinado p/ o nginx
docker compose up --build         # sobe db + api + web
```

- Web (HTTPS): https://localhost (HTTP :8080 redireciona para HTTPS :443)
- API: https://localhost/api/v1/health (ou direto em http://localhost:4000/api/v1/health)

> O nginx serve a SPA por HTTPS. Em produção o cookie de refresh é `Secure`,
> então o acesso precisa ser por HTTPS para a renovação de sessão funcionar.
> Gere o certificado com `bash scripts/gen-certs.sh <IP/DNS>` (arquivos em `certs/`,
> fora do versionamento).

Popule os dados DEMO (idempotente):

```bash
docker compose --profile tools run --rm seed
```

## Acessos DEMO

| Papel | E-mail | Senha |
|-------|--------|-------|
| ADMIN | `admin@suporte.local` | `Admin@123` |
| MANAGER | `maria.oliveira@suporte.local` | `Suporte@123` |
| CONSULTANT | `carlos.souza@suporte.local` | `Suporte@123` |

> Os dados do seed são **fictícios** (DEMO). Nenhuma pessoa real.

## Desenvolvimento local (sem Docker)

### Banco
Suba um PostgreSQL e aponte `DATABASE_URL` (veja `backend/.env.example`).

### Backend
```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate:dev     # aplica migrations
npm run seed                   # dados DEMO
npm run dev                    # http://localhost:4000
```

### Frontend
```bash
cd frontend
npm install
npm run dev                    # http://localhost:5173 (proxy /api -> :4000)
```

## Scripts úteis

| Onde | Comando | O que faz |
|------|---------|-----------|
| raiz | `bash scripts/smoke.sh` | **Teste de fumaça não-destrutivo** (health, login, leituras) — ideal depois de um deploy. Só o ADMIN é obrigatório; MANAGER/CONSULTANT são testados se `SMOKE_MANAGER_*`/`SMOKE_CONSULTANT_*` forem informados |
| raiz | `bash scripts/backup-db.sh` | **Backup** (dump SQL em `backups/` + arquivo `.tar.gz` dos anexos `data/`) — não-destrutivo |
| raiz | `bash scripts/acceptance.sh` | **Suíte de aceite** contra a API no ar; **apaga os dados e restaura o seed DEMO** (destrutiva — ver abaixo) |
| raiz | `backend/prisma/clear-data.js` (ou `npm run clear:data`) | **Limpeza de go-live**: apaga os dados (preservando o catálogo) e cria 1 ADMIN. Exige `CONFIRM_CLEAR=yes` + `ADMIN_NAME/EMAIL/PASSWORD`; `CLEAR_CATALOG=yes` apaga tudo |
| raiz | `bash scripts/gen-certs.sh <IP/DNS>` | Gera o certificado TLS autoassinado do nginx em `certs/` |
| backend | `npm run typecheck` | Checagem de tipos |
| backend | `npm run build` | Compila para `dist/` |
| backend | `npm run seed` | Seed DEMO |
| backend | `npm run prisma:studio` | Prisma Studio |
| frontend | `npm run typecheck` | Checagem de tipos |
| frontend | `npm run build` | Build de produção |

A suíte de aceite exige a API, o frontend e o seed DEMO aplicados. Ela aceita
`API_URL`, `WEB_URL`, `NODE_BIN`, `CURL_BIN`, `PSQL_BIN`, `NPM_BIN`, `WORK_DIR`,
`DB_*`, `RESET_DEMO` e `ALLOW_DATA_LOSS` — os valores padrão servem para o
ambiente local descrito acima.

Exemplo do smoke em um ambiente real (só o admin existe):

```bash
API_URL=https://10.0.0.200/api/v1 WEB_URL=https://10.0.0.200 SMOKE_INSECURE=1 \
NODE_BIN=node CURL_BIN=curl \
SMOKE_ADMIN_EMAIL="admin@empresa.com" SMOKE_ADMIN_PASSWORD="..." \
bash scripts/smoke.sh
```

### Persistência de dados (importante)

Os dados ficam num **volume Docker nomeado** (`suporte-skills_dbdata`, em
`/var/lib/postgresql/data`) e os anexos (PDFs) em **`./data/uploads`** (bind mount
`/app/uploads`); ambos **persistem** entre reinícios e `docker compose up -d`. Eles
**só** voltam ao estado de demonstração quando algo roda o seed ou a limpeza da suíte:

- `npm run seed` → reaplica (idempotente) os registros DEMO por cima.
- `bash scripts/acceptance.sh` com `RESET_DEMO=1` (**padrão**) → **apaga todos os
  dados** (e os anexos de teste) e reaplica o seed ao final.
- `npm run clear:data` (`clear-data.js`) → **limpeza de go-live**: apaga pessoas e
  seus vínculos/roadmap, preserva o catálogo e as fontes, apaga os anexos e cria 1
  ADMIN. É destrutiva e pede confirmação explícita.

Por isso, **em ambiente com dados reais não rode a suíte de aceite**: use
`RESET_DEMO=0` (não toca no banco) ou, melhor, `bash scripts/smoke.sh`
(não-destrutivo). A suíte ainda **aborta** antes de qualquer teste se encontrar
registros que não pertencem ao seed, exigindo `ALLOW_DATA_LOSS=1` para prosseguir.

Como rede de segurança, a limpeza da suíte gera **automaticamente um dump** em
`backups/` antes de apagar (`SKIP_BACKUP=1` desativa); se o backup falhar com dados
reais, ela aborta. Para backup manual a qualquer momento: `bash scripts/backup-db.sh`
(mantém os 10 mais recentes). **Restaurar:** `psql -U suporte -h localhost -d suporte_skills
< backups/arquivo.sql` (ou `docker compose exec -T db psql -U suporte -d suporte_skills <
backups/arquivo.sql`).

## Estrutura

```
suporte-skills/
├── frontend/   SPA React
├── backend/    API NestJS (prisma/ = schema, migrations, seed, clear-data.js)
├── database/   Scripts de banco
├── docs/       Documentação (ver docs/ARCHITECTURE.md e docs/DECISIONS.md)
├── scripts/    Operações e QA (smoke.sh, backup-db.sh, acceptance.sh, gen-certs.sh)
├── data/       Anexos enviados (uploads/; fora do git)
├── backups/    Backups do banco e dos anexos (fora do git)
├── certs/      Certificado TLS do nginx (fora do git)
└── docker-compose.yml
```

## Funcionalidades entregues

| Módulo | O que faz |
|--------|-----------|
| **Dashboard** | KPIs, distribuição de status, próximos vencimentos, cobertura tecnológica por tecnologia e alertas (tudo calculado no backend) |
| **Profissionais** | Cadastro com cargo, tipo, senioridade, papel e status; perfil com abas de resumo, certificações, tecnologias, roadmap e histórico |
| **Fabricantes / Tecnologias / Certificações** | Catálogo com CRUD, níveis, validade, status de catálogo e vínculos entre si |
| **Certificações do profissional** | Vínculo com obtenção/validade, **status dinâmico** (ACTIVE/EXPIRING/EXPIRED/NO_EXPIRATION), renovação com histórico, comprovante por **URL** e **anexo do PDF** (guardado no servidor, baixado por rota autenticada) |
| **Roadmap técnico** | Lista com filtros, Kanban com drag-and-drop, timeline e marcação de atrasados |
| **Tec News** | Novidades dos canais oficiais (RSS/Atom) dos fabricantes, com ingestão automática, curadoria manual, filtros por fabricante/tecnologia/tipo, destaques e leitura/salvo por usuário |
| **Resumo inteligente (Tec News)** | Painel de destaques para o consultor, com resumo por IA focado em funcionalidades de produto e certificações técnicas; relevância e ordenação "mais relevantes" |
| **Configurações** | Página administrativa (ADMIN) para ativar/ajustar a IA do Tec News pela interface, com teste de conexão; chave guardada cifrada |
| **Releases** | Changelog do sistema: versões com mudanças por categoria (novidade, melhoria, correção, segurança, infra) e destaque da versão atual |
| **Relatórios** | Certificações, vencimentos, roadmap e por fabricante — em tela e **exportação CSV** (UTF-8 BOM, separador `;`) |
| **Importação CSV** | Prévia validada linha a linha, confirmação e relatório de erros para profissionais e certificações |
| **Acessos** | ADMIN/MANAGER com acesso total; CONSULTANT restrito ao próprio perfil, onde mantém os próprios vínculos de certificação |
| **Senha provisória** | ADMIN cria o acesso com senha provisória; no 1º login o usuário é obrigado a definir uma nova senha (tela dedicada), com bloqueio das demais rotas e revogação das sessões |
| **Alertas e auditoria** | Alertas de vencimento/roadmap/cobertura e log de alterações (`audit_logs`) |

## Configuração

Tudo por variáveis de ambiente (`.env.example` na raiz para o Docker, `backend/.env.example`
para execução local). Principais:

| Variável | Uso |
|----------|-----|
| `DATABASE_URL` | Conexão PostgreSQL |
| `API_PORT` / `WEB_PORT` / `WEB_TLS_PORT` | Portas publicadas (API, HTTP→redirect, HTTPS) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Segredos dos tokens — em produção exigidos com **≥ 32 caracteres e distintos**, sob pena de a API não subir |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | Validades (padrão `15m` / `7d`) |
| `CORS_ORIGIN` | Origens permitidas (lista separada por vírgula) |
| `CERT_EXPIRING_DAYS` | Janela de "expirando" (padrão 90) |
| `BUSINESS_TIMEZONE` | Fuso das regras (padrão `America/Sao_Paulo`) |
| `AUTH_LOGIN_MAX_ATTEMPTS` / `AUTH_LOGIN_WINDOW_MINUTES` | Proteção contra força bruta no login (padrão 5/15 em produção) |
| `NEWS_SYNC_ENABLED` | Liga a ingestão agendada dos feeds do Tec News (padrão `false`; exige saída HTTPS para os fabricantes) |
| `NEWS_SYNC_INTERVAL_MINUTES` | Intervalo entre sincronizações (padrão 360) |
| `NEWS_FETCH_TIMEOUT_MS` | Timeout por requisição de feed (padrão 10000) |
| `NEWS_MAX_ITEMS_PER_SOURCE` | Máximo de itens lidos por fonte em cada sincronização (padrão 30) |
| `NEWS_DIGEST_ENABLED` | Liga o resumo inteligente automático ao fim da sincronização (padrão `false`; exige IA configurada) |
| `NEWS_DIGEST_WINDOW_DAYS` | Janela de novidades considerada no resumo, em dias (padrão 7) |
| `NEWS_DIGEST_MAX_ITEMS` | Máximo de novidades enviadas à IA por resumo (padrão 20) |
| `AI_ENABLED` | Liga a classificação/resumo por IA (padrão `false`; exige `AI_API_KEY`) |
| `AI_BASE_URL` | Endpoint compatível com OpenAI (padrão `https://api.openai.com/v1`) |
| `AI_API_KEY` | Chave da API de IA (só no servidor) |
| `AI_MODEL` | Modelo usado no resumo (padrão `gpt-4o-mini`) |
| `AI_TIMEOUT_MS` | Timeout da chamada de IA (padrão 20000) |
| `SETTINGS_ENCRYPTION_KEY` | Segredo para cifrar valores sensíveis salvos pela interface (opcional; usa o `JWT_ACCESS_SECRET` se vazio) |
| `UPLOADS_DIR` | Pasta persistente dos anexos (padrão `uploads`; no Docker: `/app/uploads` = bind mount `./data/uploads`) |
| `MAX_UPLOAD_MB` | Limite de tamanho por anexo em MB (1–50, padrão 10) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Credenciais do ADMIN no seed |

## Documentação

- [Requisitos](./docs/PRODUCT_REQUIREMENTS.md)
- [Arquitetura](./docs/ARCHITECTURE.md)
- [Banco de dados](./docs/DATABASE.md)
- [API](./docs/API.md)
- [Roadmap / fases](./docs/ROADMAP.md)
- [Decisões (ADR)](./docs/DECISIONS.md)
- [QA / qualidade](./docs/QA.md)

## Status

**Versão atual: `0.6.0`** — MVP concluído (fases 0 a 8: arquitetura, fundação, cadastros,
relacionamentos, roadmap, dashboard, relatórios, importação e QA) e os módulos pós-MVP:

| Decisão | Entrega |
|---------|---------|
| D-019 | Autoatendimento do CONSULTANT no próprio perfil |
| D-020 | **Tec News** (RSS/Atom dos fabricantes + curadoria) |
| D-021 | **Releases** (changelog do sistema) |
| D-022 | **Resumo inteligente** do Tec News (IA) |
| D-023 | **Configurações** de IA pela interface (ADMIN) |
| D-024 | **Senha provisória** com troca obrigatória no 1º acesso |
| D-025 | **Anexo do comprovante** (PDF) por certificação |

Typecheck e build limpos em backend e frontend; imagem Docker publicada na VM
(10.0.0.200) com HTTPS. A suíte de aceite cobre os blocos 11f (D-024) e 11g (D-025) e o
estado DEMO de referência (ver [`docs/QA.md`](./docs/QA.md)); o deploy em ambiente com dados
reais é validado pelo `smoke.sh` (não-destrutivo).

A ingestão automática do Tec News é **opt-in** (`NEWS_SYNC_ENABLED=true`): sem ela, o
módulo funciona com a curadoria manual e o botão "Sincronizar". Os cinco fabricantes do
escopo inicial (Red Hat, Nutanix, Veeam, ExaGrid, SUSE) já vêm com feed cadastrado no seed.

A **relevância** das novidades (foco em funcionalidades e certificações) é sempre calculada;
o **resumo inteligente** aceita qualquer endpoint compatível com OpenAI (OpenAI, DeepSeek,
Groq, OpenRouter, Ollama) e é configurado pela página **Configurações** (ADMIN) ou por
variáveis de ambiente (`AI_*`, `NEWS_DIGEST_*`) — a interface tem precedência. A chave é
guardada **cifrada** e nunca é devolvida pela API. Sem IA, o painel de destaques fica oculto
e a lista continua ordenável por relevância.

Fora do MVP (arquitetura preparada): Skills com níveis, Treinamentos/Cursos, Projetos,
Parcerias e requisitos, Gap Analysis, Capacity Planning, integração Zoho e
scraping/monitoramento avançado de fabricantes (o Tec News cobre a via RSS/Atom).
