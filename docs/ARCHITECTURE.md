# Arquitetura — Suporte Skills

## 1. Visão geral

Monolito modular com separação por domínio (microserviços seriam
overengineering neste momento).

```
Frontend SPA (React)  ──HTTP/JSON /api/v1──▶  API NestJS  ──Prisma──▶  PostgreSQL
       │                                          │
   nginx (prod) / vite (dev)              shared/domain (regras)
```

- **Frontend**: React + TypeScript + Vite + Tailwind + TanStack Query +
  React Router + React Hook Form + Zod. Componentes no padrão shadcn/ui.
- **Backend**: NestJS + TypeScript, modular por domínio, Prisma ORM,
  validação com class-validator, autenticação JWT + Passport.
- **Banco**: PostgreSQL 16.
- **Infra**: Docker + Docker Compose (`db`, `api`, `web`, `seed`).

## 2. Estrutura de diretórios

```
suporte-skills/
├── frontend/         # SPA React
│   └── src/{components,layouts,pages,features,services,hooks,types,utils,styles}
├── backend/          # API NestJS
│   ├── prisma/       # schema, migrations, seed
│   └── src/
│       ├── modules/  # auth, health, professionals, vendors, technologies,
│       │             # certifications, roadmap, dashboard, reports, imports, news
│       ├── shared/   # domain, guards, decorators, filters, common
│       ├── database/ # PrismaService/Module
│       └── config/   # configuration + env.validation
├── database/         # scripts/artefatos de banco (init, backups)
├── docs/             # documentação viva
├── docker-compose.yml
├── .env.example
└── README.md
```

## 3. Camadas do backend

`controller` (HTTP) → `service` (regra de negócio) → `repository` (Prisma).

Regras transversais ficam em `shared/domain`:
- `CertificationStatusService` — status de validade calculado em runtime.
- `CoverageService` — fórmula de cobertura tecnológica (substituível).
- (futuro) `RoadmapRulesService`, `GapAnalysisService`.

Utilitários compartilhados: `shared/audit` (log de alterações, aceita cliente de
transação), `shared/importing` (parser CSV tolerante e datas estritas),
`shared/reporting` (definição de colunas/linhas + exportador CSV),
`shared/common/access` (escopo do CONSULTANT) e o filtro global de exceções.

### 3.1 Tec News (ingestão de feeds)

O módulo `news` combina **ingestão automática** e **curadoria manual** (D-020):

- `feed-parser.ts` — parser RSS 2.0/Atom tolerante e próprio (sem dependência externa);
  extrai título, link, id, resumo, autor e data e ignora entradas malformadas.
- `news-classifier.ts` — classifica o item em `RELEASE | CERTIFICATION | FEATURE |
  SECURITY | EVENT | GENERAL` por palavras-chave (PT/EN); substituível por IA depois.
- `news-sync.service.ts` — busca cada `NewsSource` ativa, deduplica **pela URL** (única,
  via `upsert`) e registra o resultado na fonte (`last_status`, `last_error`,
  `last_item_count`). Uma fonte com erro não interrompe as demais.
- `news-sync.scheduler.ts` — agenda a sincronização por `setInterval` (opt-in via
  `NEWS_SYNC_ENABLED`), sem cron nem dependência de biblioteca.
- Leitura/salvo são **por usuário** (`news_read_states`); o escopo de escrita é
  ADMIN/MANAGER, exceto ler/salvar itens, disponível a qualquer autenticado.

## 4. Segurança

- `JwtAuthGuard` global: toda rota exige autenticação, exceto `@Public()`.
- `RolesGuard` global: aplica `@Roles(...)` declarado na rota.
- **Escopo por dono (D-019):** `assertProfessionalAccess` garante que o CONSULTANT só
  acessa/edita os próprios dados; ADMIN/MANAGER acessam qualquer profissional.
- Access token (JWT, curto) em memória; refresh token opaco em cookie
  `httpOnly`/`SameSite=Lax`/`Secure` (produção), com **rotação** e revogação
  persistida (`refresh_tokens`). **Reuso** de token já rotacionado revoga todas as
  sessões do usuário.
- **Limitador de login** por IP + e-mail (apenas tentativas falhas), respondendo
  `429` ao exceder (`AUTH_LOGIN_MAX_ATTEMPTS`).
- Senhas com **Argon2** (`@node-rs/argon2`).
- `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`) com
  datas estritas; `Helmet` para headers HTTP; CORS restrito a `CORS_ORIGIN`.
- `AllExceptionsFilter`: respostas de erro padronizadas, sem vazar stack trace;
  mapeia erros Prisma (P2002/P2025/P2003 e falhas de validação → 400).
- **CSV injection** neutralizada na exportação (D-018).
- **Tec News:** escrita de itens/fontes e disparo de sincronização restritos a
  ADMIN/MANAGER (`@Roles`); ler/marcar lido/salvar liberado a qualquer autenticado. A
  ingestão agendada é opt-in e requer saída HTTPS para os fabricantes (desligável). O
  parser não executa conteúdo do feed; links externos abrem com `rel="noreferrer"`.

## 5. Autenticação (fluxo)

1. `POST /api/v1/auth/login` → valida credenciais (com limitador de falhas → `429`),
   devolve `accessToken` e seta cookie de refresh.
2. `POST /api/v1/auth/refresh` → valida cookie, **rotaciona** o refresh e emite
   novo access token; reuso de token rotacionado revoga todas as sessões.
3. `POST /api/v1/auth/logout` → revoga o refresh e limpa o cookie.
4. `GET /api/v1/auth/me` → usuário autenticado.
5. A SPA reidrata a sessão no boot via `refresh` (o access token é volátil). Se o
   refresh falhar, o interceptor avisa o `AuthProvider`, que limpa a sessão e
   devolve o usuário ao login.

## 6. Configuração

`@nestjs/config` com `load` (configuration.ts) e `validate` (env.validation.ts).
Variáveis principais: `DATABASE_URL`, `API_PORT`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `CORS_ORIGIN`,
`CERT_EXPIRING_DAYS`, `BUSINESS_TIMEZONE`, `AUTH_LOGIN_MAX_ATTEMPTS`,
`AUTH_LOGIN_WINDOW_MINUTES`, `NEWS_SYNC_ENABLED`, `NEWS_SYNC_INTERVAL_MINUTES`,
`NEWS_FETCH_TIMEOUT_MS`, `NEWS_MAX_ITEMS_PER_SOURCE`, `SEED_ADMIN_EMAIL`,
`SEED_ADMIN_PASSWORD`.
Em `NODE_ENV=production` a validação exige segredos JWT com ≥ 32 caracteres e
distintos entre si, e `CORS_ORIGIN` vazio cai no valor padrão.

## 7. Frontend

- `services/api.ts`: instância axios (`/api/v1`, `withCredentials`) com
  interceptor que renova o access token no 401 e repete a requisição, além do
  gancho de sessão expirada.
- `hooks/use-auth.tsx`, `hooks/use-theme.tsx`, `hooks/use-permissions.ts`
  (sessão, tema e permissões — inclui `canEditProfessional`).
- `layouts/`: AppShell + Sidebar + Topbar (sidebar com os 8 itens do menu, drawer
  no mobile) e `layouts/navigation.ts` (itens visíveis por papel).
- `components/`: primitivas UI (Button, Card, Input, Select, Badge, Table, Tabs,
  Dialog, Skeleton, Spinner) e estados de feedback (Loading/Empty/Error).
- `components/protected-route.tsx` (sessão) e `components/require-role.tsx`
  (área por papel) — a autorização real é sempre no backend.
- `features/`: uma pasta por módulo (dashboard, professionals, vendors,
  technologies, certifications, roadmap, reports, imports, news, auth).

## 8. Decisões

Ver [`DECISIONS.md`](./DECISIONS.md).
