# Banco de Dados — Suporte Skills

Fonte da verdade: [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).
Migrations versionadas em `backend/prisma/migrations`.

## 1. Diagrama de relacionamentos

```
Vendor 1─N Technology 1─N Certification
Vendor 1─N Certification
Professional 1─N ProfessionalCertification N─1 Certification   (N:N)
Professional 1─N RoadmapItem N─1 Technology (opcional)
RoadmapItem N─1 Certification (opcional)
RoadmapItem N─1 Professional (owner, opcional)
Professional 1─N RefreshToken
Professional 1─N AuditLog
Vendor 1─N NewsSource N─1 Technology (opcional)
Vendor 1─N NewsItem N─1 Technology (opcional)
NewsSource 1─N NewsItem
NewsItem 1─N NewsReadState N─1 Professional   (N:N)
Release 1─N ReleaseItem
```

Decisão **D-003**: `users` e `professionals` são a **mesma tabela**
(`professionals`); a entidade carrega perfil profissional **e** credenciais.

## 2. Tabelas

### professionals
`id, name, email (único), password_hash (nullable), provider_id, role
[ADMIN|MANAGER|CONSULTANT], active, must_change_password, position, professional_type,
seniority, hire_date, notes, created_at, updated_at`

> Profissional sem `password_hash` existe no cadastro, mas não autentica.
> `must_change_password` (D-024) marca senha provisória: o usuário só acessa a troca
> de senha até definir uma nova.

### refresh_tokens
`id, professional_id, token_hash, expires_at, revoked_at, created_at`

### vendors
`id, name (único), website, logo_url, partnership_status, partnership_level,
partnership_start_date, partnership_renewal_date, notes, active, timestamps`

### technologies
`id, vendor_id, name, category, description, active, timestamps`
Único: `(vendor_id, name)`.

### certifications
`id, vendor_id, technology_id (nullable), name, code, level, official_url,
validity_months (nullable), catalog_status, description, notes, active, timestamps`

### professional_certifications
`id, professional_id, certification_id, certificate_number, obtained_at,
expires_at (nullable), proof_url, notes, timestamps`
Histórico: renovação cria **nova linha** (D-004).

### roadmap_items
`id, professional_id, technology_id (nullable), certification_id (nullable),
title, objective, description, type, priority, status, start_date, due_date,
completed_at, owner_id, notes, timestamps`

### audit_logs
`id, actor_id (nullable), entity, entity_id, action [CREATE|UPDATE|DELETE],
before (jsonb), after (jsonb), created_at`

### news_sources
`id, vendor_id, technology_id (nullable), name, url (nullable), connector_type
[RSS|ATOM|MANUAL], active, fetch_interval_minutes (nullable), last_fetched_at,
last_status, last_error, last_item_count, timestamps`
Fonte de novidades de um fabricante; `url` é obrigatória para fontes automáticas (D-020).

### news_items
`id, source_id (nullable), vendor_id (nullable), technology_id (nullable), external_id,
url (único), title, summary, author, kind [RELEASE|CERTIFICATION|FEATURE|SECURITY|EVENT|
GENERAL], origin, published_at (nullable), pinned, hidden, relevance_score (0..100),
relevance_focus [FEATURE|CERTIFICATION|SECURITY|RELEASE|OTHER] (nullable), relevance_note
(nullable), scored_at (nullable), timestamps`
Deduplicado pela `url`; `hidden` implementa o soft delete; a leitura não é por usuário
aqui. A relevância para o consultor é calculada por heurística e/ou IA (D-022).

### news_read_states
`id, news_item_id, professional_id, read_at (nullable), saved_at (nullable), timestamps`
Único: `(news_item_id, professional_id)`. Estado de leitura/salvo **por usuário** (D-020).

### news_digests
`id, title, summary, highlights (jsonb), item_count, period_start (nullable),
period_end (nullable), model (nullable), origin [manual|sync], generated_by (nullable),
created_at`
Resumo inteligente dos destaques (D-022). `highlights` guarda um snapshot em JSON
(`id/título/link/tipo/foco/motivo/score`) do momento da geração; o estado de leitura/salvo é
resolvido por usuário na leitura.

### releases
`id, version (único), title, summary (nullable), released_at, current, hidden, timestamps`
Changelog do sistema (D-021). No máximo uma linha com `current = true`; `hidden` faz o
soft delete.

### release_items
`id, release_id, category [FEATURE|IMPROVEMENT|FIX|SECURITY|INFRA|OTHER], description,
position, timestamps`
Itens de uma release; `position` define a ordem de exibição (cascade ao remover a release).

### app_settings
`key (PK), value (jsonb), timestamps`
Configurações editáveis pela interface (D-023). Hoje guarda `key = 'ai'` com as preferências
de IA do Tec News; a chave da API é gravada **cifrada** (`apiKeyEnc`, AES-256-GCM) e nunca é
devolvida pela API.

## 3. Enums

| Enum | Valores |
|------|---------|
| Role | ADMIN, MANAGER, CONSULTANT |
| ProfessionalType | CLT, PJ, INTERN, PARTNER, TEMPORARY |
| Seniority | JUNIOR, MID, SENIOR, SPECIALIST, LEAD |
| PartnershipStatus | NONE, ACTIVE, PENDING, SUSPENDED, EXPIRED |
| TechnologyCategory | OPERATING_SYSTEM, VIRTUALIZATION, CONTAINER_PLATFORM, CLOUD, AUTOMATION, BACKUP, STORAGE, HARDWARE, NETWORK, MANAGEMENT, SECURITY, OTHER |
| CertificationLevel | FOUNDATIONAL, ASSOCIATE, PROFESSIONAL, EXPERT, SPECIALIST, ARCHITECT |
| CatalogStatus | ACTIVE, UPDATING, DISCONTINUED, REPLACED |
| RoadmapType | CERTIFICATION, RENEWAL, COURSE, TRAINING, PROJECT, LAB |
| RoadmapPriority | CRITICAL, HIGH, MEDIUM, LOW |
| RoadmapStatus | BACKLOG, PLANNED, IN_PROGRESS, COMPLETED, CANCELLED |
| AuditAction | CREATE, UPDATE, DELETE |
| NewsConnectorType | RSS, ATOM, MANUAL |
| NewsKind | RELEASE, CERTIFICATION, FEATURE, SECURITY, EVENT, GENERAL |
| NewsFocus | FEATURE, CERTIFICATION, SECURITY, RELEASE, OTHER |
| ReleaseCategory | FEATURE, IMPROVEMENT, FIX, SECURITY, INFRA, OTHER |

## 4. Status de certificação (derivado — não é coluna)

Calculado por `CertificationStatusService` a partir de `expires_at` e de
`CERT_EXPIRING_DAYS`: `EXPIRED`, `EXPIRING`, `ACTIVE`, `NO_EXPIRATION`.

## 5. Índices relevantes

- `professionals`: `active`, `role`.
- `professional_certifications`: `professional_id`, `certification_id`, `expires_at`.
- `roadmap_items`: `professional_id`, `status`, `due_date`.
- `audit_logs`: `(entity, entity_id)`, `created_at`.
- `news_sources`: `vendor_id`, `technology_id`, `active`.
- `news_items`: `url` (único), `vendor_id`, `technology_id`, `kind`, `published_at`,
  `pinned`, `hidden`, `relevance_score`.
- `news_read_states`: `(news_item_id, professional_id)` (único), `professional_id`.
- `news_digests`: `created_at`.
- `releases`: `version` (único), `hidden`, `released_at`.
- `release_items`: `release_id`.

## 6. Migrations

| Migration | Conteúdo |
|-----------|----------|
| `20260930000000_init` | Criação de todos os enums e tabelas do MVP. |
| `20261001000000_tec_news` | Tabelas do Tec News (`news_sources`, `news_items`, `news_read_states`) e enums `NewsConnectorType`/`NewsKind`. |
| `20261001120000_releases` | Tabelas de Releases (`releases`, `release_items`) e enum `ReleaseCategory`. |
| `20261001150000_news_digest` | Campos de relevância em `news_items`, tabela `news_digests` e enum `NewsFocus` (D-022). |
| `20261001180000_app_settings` | Tabela `app_settings` (configurações editáveis pela interface; D-023). |
| `20261002120000_must_change_password` | Coluna `must_change_password` em `professionals` (senha provisória; D-024). |
