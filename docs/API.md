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
| GET | `/auth/me` | Bearer | Usuário autenticado. |
| GET | `/professionals` | ADMIN/MANAGER | Lista paginada + `stats` (certificações, expirando, vencidas, roadmap aberto). Filtros: `search, active, role, professionalType, seniority`. |
| GET | `/professionals/:id` | autenticado (CONSULTANT só o próprio) | Detalhe com `stats`. |
| POST | `/professionals` | ADMIN/MANAGER | Cria. `role`/`password` apenas ADMIN. |
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

Cada item retorna `isOverdue` e `daysToDue` calculados no backend.

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

Parâmetros comuns: `format=json|csv` (padrão `json`), `professionalId`, `vendorId`, `technologyId`.
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
