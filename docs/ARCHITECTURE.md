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
│       │             # certifications, roadmap, dashboard, reports, imports, news, releases
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
  SECURITY | EVENT | GENERAL` por palavras-chave (PT/EN).
- `news-relevance.ts` — relevância **determinística** (0..100) para o consultor, com foco em
  funcionalidades e certificações: palavras-chave (PT/EN) + `kind` + recência definem
  `relevanceScore`, `relevanceFocus` (`FEATURE|CERTIFICATION|SECURITY|RELEASE|OTHER`) e um
  motivo curto. Roda na ingestão, na curadoria e num backfill no start.
- `news-ai.service.ts` — cliente mínimo de um endpoint **compatível com OpenAI**
  (`chat/completions`, fetch nativo). Opt-in por env (`AI_*`); devolve o resumo/destaques em
  JSON e degrada com `503` quando desligado ou em falha.
- `news-digest.service.ts` — seleciona as novidades candidatas do período, chama a IA,
  **persiste** o digest (`news_digests`, snapshot em JSON) e reflete o ranking nos itens.
  Gerado automaticamente ao fim da sincronização (com novidades novas) e sob demanda.
- `news-sync.service.ts` — busca cada `NewsSource` ativa, deduplica **pela URL** (única,
  via `upsert`), calcula a relevância heurística e registra o resultado na fonte
  (`last_status`, `last_error`, `last_item_count`). Uma fonte com erro não interrompe as
  demais.
- `news-sync.scheduler.ts` — agenda a sincronização por `setInterval` (opt-in via
  `NEWS_SYNC_ENABLED`), sem cron nem dependência de biblioteca; ao final, atualiza o resumo
  quando `NEWS_DIGEST_ENABLED=true` e houve novidade nova.
- Leitura/salvo são **por usuário** (`news_read_states`); o escopo de escrita é
  ADMIN/MANAGER, exceto ler/salvar itens e ler o resumo, disponíveis a qualquer autenticado.

### 3.2 Releases (changelog do sistema)

Módulo `releases`: changelog do próprio sistema, restrito a ADMIN/MANAGER (D-021).
`Release` (versão `X.Y.Z` única, título, resumo, data, flag `current`) agrupa
`ReleaseItem` por categoria (`FEATURE|IMPROVEMENT|FIX|SECURITY|INFRA|OTHER`). No máximo uma
release é a **atual** — definir uma nova desmarca as demais, em transação. `PUT` com
`items` substitui a lista (deleteMany + createMany). Itens usam soft delete (`hidden`) e
todas as escritas são auditadas. O rodapé da navegação exibe a versão atual via constante
`APP_VERSION` (`frontend/src/config/version.ts`), mantida à mão em sincronia com a release
marcada como atual.

### 3.3 Configurações (parâmetros de IA)

Módulo `settings` (ADMIN): guarda parâmetros editáveis pela interface em `app_settings`
(chave/valor JSON). `SettingsService.getResolved()` resolve a configuração efetiva com
**banco sobrepondo o ambiente** (valores salvos vencem; o resto cai em `AI_*` /
`NEWS_DIGEST_*`). Segredos (chave da API) são **cifrados em repouso** (AES-256-GCM;
`secret-crypto.ts`) e **nunca devolvidos** pela API. O cliente HTTP de IA foi extraído para
`shared/ai/ai-client.service.ts` (`AiClient.complete`), reutilizado pelo resumo do Tec News
(`news-ai.service.ts`) e pelo teste de conexão (`POST /settings/ai/test`). O módulo `news`
passou a resolver a IA por `SettingsService` (assíncrono).

## 4. Segurança

- `JwtAuthGuard` global: toda rota exige autenticação, exceto `@Public()`.
- `RolesGuard` global: aplica `@Roles(...)` declarado na rota.
- **Escopo por dono (D-019):** `assertProfessionalAccess` garante que o CONSULTANT só
  acessa/edita os próprios dados; ADMIN/MANAGER acessam qualquer profissional.
- **Armazenamento de anexos (D-025/D-026):** os PDFs são gravados por
  `AttachmentStorageService` em `UPLOADS_DIR/<recurso>` (`certificates/` para o vínculo de
  certificação; `roadmap/` para os itens de roadmap), um bind mount `./data/uploads`,
  **fora do web root**, com nome aleatório (UUID) e metadados só no banco. A leitura passa
  pelas rotas autenticadas `GET .../attachment` (escopo D-019/D-026). Um bind mount evita
  perda ao recriar containers e entra no backup (`scripts/backup-db.sh`).
- **Escopo do roadmap (D-026):** a aba Roadmap do perfil usa rotas aninhadas
  `/professionals/:id/roadmap[...]`; `assertProfessionalAccess` garante que o CONSULTANT só
  acessa/edita os próprios itens (qualquer outro `:id` → `403`) e o `professionalId` é
  fixado pela rota. O board global `/roadmap` segue restrito a ADMIN/MANAGER.
- **Senha provisória (D-024):** `PasswordChangeRequiredGuard` (global, após o
  `JwtAuthGuard`) bloqueia todo o app enquanto `mustChangePassword` for `true`, exceto as
  rotas marcadas com `@AllowProvisionalPassword()` (`POST /auth/change-password`,
  `GET /auth/me`, logout). A troca exige a senha atual, limpa a marca, **revoga as sessões
  anteriores** e emite novos tokens. Somente ADMIN define senha/`mustChangePassword`; o
  frontend força a tela `/trocar-senha` via `ProtectedRoute`.
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
  ADMIN/MANAGER (`@Roles`); ler/marcar lido/salvar e **ler o resumo** liberados a qualquer
  autenticado; **gerar o resumo** é da gestão (`POST /news/digest`). A ingestão agendada é
  opt-in e requer saída HTTPS para os fabricantes (desligável). O parser não executa
  conteúdo do feed; links externos abrem com `rel="noreferrer"`. A chave de IA só existe no
  servidor (`AI_API_KEY`), nunca é exposta ao cliente, e o envio à IA é opt-in.
- **Releases:** todas as rotas restritas a ADMIN/MANAGER (`@Roles` no controller) e
  reforçadas no frontend por `RequireRole`.
- **Configurações (D-023):** restritas a ADMIN. A chave de IA é gravada **cifrada**
  (AES-256-GCM) e **nunca** retorna nas respostas (`apiKeySet`/`apiKeySource` no lugar); a
  auditoria das alterações também omite o segredo. O segredo de cifra vem de
  `SETTINGS_ENCRYPTION_KEY` (fallback: o segredo de acesso do JWT).

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
`NEWS_FETCH_TIMEOUT_MS`, `NEWS_MAX_ITEMS_PER_SOURCE`, `NEWS_DIGEST_ENABLED`,
`NEWS_DIGEST_WINDOW_DAYS`, `NEWS_DIGEST_MAX_ITEMS`, `AI_ENABLED`, `AI_BASE_URL`,
`AI_API_KEY`, `AI_MODEL`, `AI_TIMEOUT_MS`, `SETTINGS_ENCRYPTION_KEY`,
`UPLOADS_DIR`, `MAX_UPLOAD_MB`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.
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
  technologies, certifications, roadmap, reports, imports, news, releases, auth).
- `config/version.ts`: versão exibida na interface (acompanha a release atual).

## 8. Decisões

Ver [`DECISIONS.md`](./DECISIONS.md).
