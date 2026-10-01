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
| raiz | `bash scripts/acceptance.sh` | **Suíte de aceite** (123 verificações) contra a API no ar; restaura o seed ao final |
| backend | `npm run typecheck` | Checagem de tipos |
| backend | `npm run build` | Compila para `dist/` |
| backend | `npm run seed` | Seed DEMO |
| backend | `npm run prisma:studio` | Prisma Studio |
| frontend | `npm run typecheck` | Checagem de tipos |
| frontend | `npm run build` | Build de produção |

A suíte de aceite exige a API, o frontend e o seed DEMO aplicados. Ela aceita
`API_URL`, `WEB_URL`, `NODE_BIN`, `CURL_BIN`, `PSQL_BIN`, `NPM_BIN`, `WORK_DIR`,
`DB_*` e `RESET_DEMO=0` (para não tocar no banco) — os valores padrão servem para o
ambiente local descrito acima.

## Estrutura

```
suporte-skills/
├── frontend/   SPA React
├── backend/    API NestJS (prisma/)
├── database/   Scripts de banco
├── docs/       Documentação (ver docs/ARCHITECTURE.md)
├── scripts/    Suíte de aceite (scripts/acceptance.sh)
└── docker-compose.yml
```

## Funcionalidades entregues

| Módulo | O que faz |
|--------|-----------|
| **Dashboard** | KPIs, distribuição de status, próximos vencimentos, cobertura tecnológica por tecnologia e alertas (tudo calculado no backend) |
| **Profissionais** | Cadastro com cargo, tipo, senioridade, papel e status; perfil com abas de resumo, certificações, tecnologias, roadmap e histórico |
| **Fabricantes / Tecnologias / Certificações** | Catálogo com CRUD, níveis, validade, status de catálogo e vínculos entre si |
| **Certificações do profissional** | Vínculo com obtenção/validade, **status dinâmico** (ACTIVE/EXPIRING/EXPIRED/NO_EXPIRATION), renovação com histórico e comprovante por URL |
| **Roadmap técnico** | Lista com filtros, Kanban com drag-and-drop, timeline e marcação de atrasados |
| **Tec News** | Novidades dos canais oficiais (RSS/Atom) dos fabricantes, com ingestão automática, curadoria manual, filtros por fabricante/tecnologia/tipo, destaques e leitura/salvo por usuário |
| **Releases** | Changelog do sistema: versões com mudanças por categoria (novidade, melhoria, correção, segurança, infra) e destaque da versão atual |
| **Relatórios** | Certificações, vencimentos, roadmap e por fabricante — em tela e **exportação CSV** (UTF-8 BOM, separador `;`) |
| **Importação CSV** | Prévia validada linha a linha, confirmação e relatório de erros para profissionais e certificações |
| **Acessos** | ADMIN/MANAGER com acesso total; CONSULTANT restrito ao próprio perfil, onde mantém os próprios vínculos de certificação |
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

**MVP concluído** — fases 0 a 8 (arquitetura, fundação, cadastros, relacionamentos,
roadmap, dashboard, relatórios, importação e QA) implementadas e validadas, mais os módulos
**Tec News** (D-020) e **Releases** (D-021). Suíte de aceite com **123 verificações,
0 falhas** (ver [`docs/QA.md`](./docs/QA.md)), typecheck e build limpos em backend e
frontend.

A ingestão automática do Tec News é **opt-in** (`NEWS_SYNC_ENABLED=true`): sem ela, o
módulo funciona com a curadoria manual e o botão "Sincronizar". Os cinco fabricantes do
escopo inicial (Red Hat, Nutanix, Veeam, ExaGrid, SUSE) já vêm com feed cadastrado no seed.

Fora do MVP (arquitetura preparada): Skills com níveis, Treinamentos, Projetos,
Parcerias e requisitos, Gap Analysis, Capacity Planning, IA, integração Zoho e
scraping/monitoramento avançado de fabricantes (o Tec News cobre a via RSS/Atom).
