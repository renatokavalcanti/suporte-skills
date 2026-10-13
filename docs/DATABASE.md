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
Client 1─N Ticket
UnmappedTicket  (fila: chamados do Zoho sem Client mapeado)
Client 1─N MonthlyMeasurement 1─N MonthlyMeasurementItem
Ticket 1─N MonthlyMeasurementItem (opcional, SetNull)
Client 1─N Contract
Ticket 1─N TimeEntry
Client 1─N GeneratedReport N─1 Professional (generatedBy, opcional)
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
expires_at (nullable), proof_url, attachment_file, attachment_name,
attachment_mime, attachment_size, attachment_uploaded_at, notes, timestamps`
Histórico: renovação cria **nova linha** (D-004).
Anexo (D-025): o PDF fica **no disco** (`UPLOADS_DIR/certificates`, nome aleatório);
o banco guarda só os metadados (`attachment_*`). `proof_url` (link externo) permanece.

### roadmap_items
`id, professional_id, technology_id (nullable), certification_id (nullable),
title, objective, description, type, priority, status, start_date, due_date,
completed_at, owner_id, notes, attachment_file, attachment_name, attachment_mime,
attachment_size, attachment_uploaded_at, timestamps`
Anexo (D-026): o PDF do comprovante do item fica no disco (`UPLOADS_DIR/roadmap`,
nome aleatório); o banco guarda só os metadados (`attachment_*`).

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

### clients
`id, name, document (único, nullable), zoho_account_id (único, nullable), active,
timestamps`
Cliente usado na Medição Mensal (D-029). `document` (CNPJ/NIF) e `zoho_account_id`
(conta no Zoho Desk) são únicos quando informados.

### tickets
`id, zoho_ticket_id (único), ticket_number (nullable), title, status, status_type
(nullable), priority (nullable), category (nullable), assignee_name (nullable),
open_date, close_date (nullable), time_spent_minutes (0), sla_compliant (nullable),
is_billable (true), contact_id (nullable), department_id (nullable), account_id (nullable),
account_name (nullable), assignee_id (nullable), technology_name (nullable),
zoho_modified_at (nullable), last_synced_at (nullable), client_id,
timestamps`
Espelho local (somente leitura) dos chamados do Zoho Desk (D-029). Datas em **UTC**;
`close_date` é a **data de referência da Medição Mensal** (interpretada em
`BUSINESS_TIMEZONE` no backend). `status` é **texto livre** (os rótulos do Zoho mudam);
`sla_compliant` é **nullable** (o Zoho pode não calcular SLA). `client_id` é FK
**obrigatória** com `onDelete: Restrict`. `zoho_modified_at` habilita a sincronização
incremental (Fase 3). Índices: `(client_id, close_date)`, `(client_id, open_date)`,
`status`, `technology_name`. Os campos `contact_id`, `department_id`, `account_id`,
`account_name`, `assignee_id` e `technology_name` foram adicionados na D-030 (opcionais).

### unmapped_tickets
`id, zoho_ticket_id (único), account_id (nullable), account_name (nullable),
subject (nullable), raw (jsonb), first_seen_at, last_seen_at`
Fila de chamados do Zoho que **ainda não foram vinculados a um `Client`** (D-029): guarda o
payload cru para não perder dados nem "adivinhar" o cliente — o vínculo é feito manualmente
(`POST /tickets/unmapped/:id/link`). Índice: `account_id`.

### monthly_measurements
`id, client_id, year, month (1..12), status [DRAFT|CLOSED], ticket_count,
time_spent_minutes, sla_evaluated_count, sla_compliant_count, closed_by_id (nullable),
closed_at (nullable), timestamps`
Medição Mensal (D-029): consolida por **cliente/mês** os chamados faturados (comprovação de
serviço). Único: `(client_id, year, month)`. Índices: `(year, month)`, `status`.
`closed_by_id` referencia `professionals` (`onDelete: SetNull`).

### monthly_measurement_items
`id, measurement_id, ticket_id (nullable), zoho_ticket_id, ticket_number (nullable), title,
status (texto), close_date (nullable), time_spent_minutes, sla_compliant (nullable),
is_billable, created_at`
**Snapshot imutável** dos chamados no fechamento (D-029). `ticket_id` referencia `tickets`
com `onDelete: SetNull` — o snapshot sobrevive se o chamado sumir. Índice: `measurement_id`.

### contracts
`id, client_id, plan_name, included_minutes (0), monthly_value (Decimal 12,2), extra_hour_value
(Decimal 12,2), balance_policy [EXPIRE|ACCUMULATE], start_date, end_date (nullable),
finance_email (nullable), active (true), timestamps`
Contrato de serviço do cliente (D-030): franquia mensal em **minutos**, valor mensal e valor
da hora adicional (R$/hora), política de saldo e vigência. Base da **regra de faturamento** do
Relatório Financeiro. `client_id` é FK com `onDelete: Restrict`. Índices: `client_id`, `active`.

### time_entries
`id, zoho_time_entry_id (único), ticket_id, owner_id (nullable), owner_name (nullable),
executed_at, minutes (0), description (nullable), is_billable (true), timestamps`
**Lançamentos de tempo** de um chamado (D-030), importados de
`GET /tickets/{id}/timeEntries` no Zoho Desk. `minutes` é **inteiro** (convertido de
horas/min/seg). `zoho_time_entry_id` é a chave de idempotência (upsert no sync). `ticket_id`
referencia `tickets` com `onDelete: Cascade`. Índices: `ticket_id`, `executed_at`.

### generated_reports
`id, client_id, type [FINANCIAL|CLIENT], period_start, period_end, billing_status
[STANDARD|WITH_EXTRA_HOURS] (nullable), file_path (nullable), file_name (nullable),
generated_by_id (nullable), generated_at, sent_at (nullable), sent_to (nullable), timestamps`
Auditoria dos **relatórios gerados** (D-030): quem gerou e quando (`generated_by_id` →
`professionals`, `onDelete: SetNull`), e o registro de envio (`sent_at`/`sent_to`).
Índices: `(client_id, type)`, `generated_at`.

### app_settings
`key (PK), value (jsonb), timestamps`
Configurações editáveis pela interface (D-023/D-030). Guarda `key = 'ai'` (preferências de IA
do Tec News), `key = 'zoho'` (integração com o Zoho Desk: data center, credenciais, escopos,
frequência), `key = 'email'` (transporte SMTP/Graph dos Relatórios) e `key = 'zoho_sync'`
(estado/última execução + histórico do espelhamento). Os segredos (`apiKeyEnc`,
`clientSecretEnc`, `refreshTokenEnc`, `smtpPasswordEnc`, `graphClientSecretEnc`) são gravados
**cifrados** (AES-256-GCM) e nunca devolvidos pela API.

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
| AuditAction | CREATE, UPDATE, DELETE || NewsConnectorType | RSS, ATOM, MANUAL |
| NewsKind | RELEASE, CERTIFICATION, FEATURE, SECURITY, EVENT, GENERAL |
| NewsFocus | FEATURE, CERTIFICATION, SECURITY, RELEASE, OTHER |
| ReleaseCategory | FEATURE, IMPROVEMENT, FIX, SECURITY, INFRA, OTHER |
| MeasurementStatus | DRAFT, CLOSED |
| BalancePolicy | EXPIRE, ACCUMULATE |
| GeneratedReportType | FINANCIAL, CLIENT |
| BillingStatus | STANDARD, WITH_EXTRA_HOURS |

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
- `contracts`: `client_id`, `active`.
- `time_entries`: `ticket_id`, `executed_at`.
- `generated_reports`: `(client_id, type)`, `generated_at`.

## 6. Migrations

| Migration | Conteúdo |
|-----------|----------|
| `20260930000000_init` | Criação de todos os enums e tabelas do MVP. |
| `20261001000000_tec_news` | Tabelas do Tec News (`news_sources`, `news_items`, `news_read_states`) e enums `NewsConnectorType`/`NewsKind`. |
| `20261001120000_releases` | Tabelas de Releases (`releases`, `release_items`) e enum `ReleaseCategory`. |
| `20261001150000_news_digest` | Campos de relevância em `news_items`, tabela `news_digests` e enum `NewsFocus` (D-022). |
| `20261001180000_app_settings` | Tabela `app_settings` (configurações editáveis pela interface; D-023). |
| `20261002120000_must_change_password` | Coluna `must_change_password` em `professionals` (senha provisória; D-024). |
| `20261002150000_certification_attachment` | Colunas de anexo (`attachment_*`) em `professional_certifications` (PDF do comprovante; D-025). |
| `20261002180000_roadmap_attachment` | Colunas de anexo (`attachment_*`) em `roadmap_items` (PDF do comprovante do item; D-026). |
| `20261009201718_add_tickets_clients` | Tabelas `clients` e `tickets` (espelho dos chamados do Zoho Desk + Medições Mensais; D-029). |
| `20261013163255_unmapped_tickets` | Tabela `unmapped_tickets` (fila de chamados do Zoho sem cliente mapeado; D-029). |
| `20261013163918_monthly_measurements` | Tabelas `monthly_measurements`/`monthly_measurement_items` (Medições Mensais; D-029). |
| `20261013172326_add_contracts_time_entries_reports` | Tabelas `contracts`, `time_entries` e `generated_reports`; colunas novas em `tickets` e enums `BalancePolicy`/`GeneratedReportType`/`BillingStatus` (D-030). |
