# Registro de Decisões Arquiteturais (ADR) — Suporte Skills

Formato: decisão, contexto, consequências.

---

## D-001 — Framework do backend: NestJS
**Data:** 30/09/2026
**Decisão:** Usar NestJS + TypeScript para a API.
**Contexto:** Requisito de arquitetura modular, testável e com autorização no
backend.
**Consequências:** Módulos por domínio, guards/pipes/DI nativos, validação
estruturada e boa testabilidade. Curva de aprendizado maior que Express puro.

---

## D-002 — Autenticação local agora, SSO depois
**Data:** 30/09/2026
**Decisão:** Login por e-mail + senha (Argon2, JWT access + refresh em cookie
httpOnly), com o campo `professionals.provider_id` já preparado para SSO futuro.
**Contexto:** Aplicação interna que deve rodar 100% offline no Docker sem
dependência de provedor externo no MVP.
**Consequências:** Sem dependência externa; migração para SSO exigirá adaptar a
camada de auth, mas sem alterar o modelo de dados.

---

## D-003 — `users` e `professionals` são uma única entidade
**Data:** 30/09/2026
**Decisão:** Fundir as duas entidades na tabela `professionals`, que carrega
perfil profissional **e** credenciais (`password_hash`, `provider_id`, `role`).
**Contexto:** No domínio, todo usuário do sistema é um profissional da empresa.
**Consequências:**
- Simplicidade: `professional_id` é a única identidade referenciada por
  certificações, roadmap e auditoria.
- Profissional sem `password_hash` existe no cadastro mas não autentica
  (`usuarios ⊆ profissionais`).
- Acopla identidade de acesso a dados de RH. **Mitigação:** se surgirem contas de
  serviço/integrações, extrair uma tabela `credentials` 1:1 — as FKs existentes
  permanecem válidas.

---

## D-004 — Renovação de certificação gera histórico
**Data:** 30/09/2026
**Decisão:** Cada renovação cria uma **nova linha** em
`professional_certifications`; nunca sobrescreve o registro anterior.
**Contexto:** Necessidade de verificar histórico e recertificações.
**Consequências:** Consultas de status devem considerar a ocorrência mais
recente/aberta; maior volume de dados (aceitável).

---

## D-005 — Comprovação apenas por URL no MVP
**Data:** 30/09/2026
**Decisão:** Campo `proof_url` (string) em vez de upload de arquivos.
**Contexto:** Simplicidade e ausência de storage no MVP.
**Consequências:** Sem upload/validação de arquivos agora; upload poderá ser
adicionado depois sem quebrar o campo existente.

---

## D-006 — Local do projeto
**Data:** 30/09/2026
**Decisão:** `C:\Users\renat\GensparkCode\suporte-skills`.
**Contexto:** Isolar do projeto `financeiro` no mesmo workspace.

---

## D-007 — Status de certificação calculado no backend
**Data:** 30/09/2026
**Decisão:** O status (`ACTIVE`/`EXPIRING`/`EXPIRED`/`NO_EXPIRATION`) não é
coluna; é derivado por `CertificationStatusService` a partir de `expires_at` e de
`CERT_EXPIRING_DAYS`.
**Contexto:** Regra do produto; evita dados inconsistentes.
**Consequências:** Filtros/ordenação por status exigirão cálculo em query
(planejar índices em `expires_at`).

---

## D-008 — Seed reaproveita o `node_modules` do build no container
**Data:** 30/09/2026
**Decisão:** A imagem de runtime da API copia o `node_modules` do estágio de
build (inclui Prisma CLI e ts-node), permitindo `prisma migrate deploy` e
`npm run seed` no container.
**Contexto:** Simplicidade operacional no MVP.
**Consequências:** Imagem maior. Otimização futura possível (imagem dedicada para
migrations/seed ou `prisma` como dependência de produção).

---

## D-009 — Exclusão é desativação (soft delete)
**Data:** 30/09/2026
**Decisão:** `DELETE` em profissionais/fabricantes/tecnologias/certificações
**não** remove a linha: apenas marca `active = false`.
**Contexto:** Excluir de verdade destruiria histórico de certificações, roadmap e
referências. O produto fala em "ativar/desativar", não em apagar.
**Consequências:** Registros desativados deixam de aparecer nas listas padrão
(filtro `active`) mas preservam integridade e histórico. A reativação é possível.
Ação sempre auditada.

---

## D-010 — Fórmula de cobertura tecnológica
**Data:** 30/09/2026
**Decisão:** cobertura = (profissionais **ativos** com ao menos uma certificação
**em vigor** da tecnologia) ÷ (total de profissionais ativos) × 100.
"Em vigor" = status `ACTIVE`, `EXPIRING` ou `NO_EXPIRATION` (exclui `EXPIRED`).
**Contexto:** o produto exige uma noção inicial de capacidade, mas sinaliza que a
fórmula deve poder evoluir (Skills, experiência prática, capacidade real).
**Consequências:** a fórmula vive isolada em `shared/domain/coverage.service.ts`
e pode ser trocada por um modelo mais sofisticado sem alterar o restante.

---

## D-011 — Dashboard em um único endpoint agregado
**Data:** 30/09/2026
**Decisão:** `GET /dashboard` devolve cards, distribuição de status, próximos
vencimentos, buckets de roadmap, alertas e cobertura em uma só resposta.
**Contexto:** performance — evitar várias chamadas do frontend e N+1.
**Consequências:** as rotas planejadas em separado (`/dashboard/expirations`,
`/coverage`, `/alerts`) não foram criadas. Consolida em ~4 consultas ao banco.

---

## D-012 — Gráficos sem biblioteca de charts
**Data:** 30/09/2026
**Decisão:** os visuais do dashboard (rosca de status, barras de cobertura,
buckets) usam CSS/SVG, sem Recharts ou similar.
**Contexto:** manter o bundle enxuto e evitar dependência pesada para gráficos
simples; prioriza legibilidade.
**Consequências:** menos dependências e bundle menor. Caso surjam gráficos
complexos (séries temporais), reavaliar a introdução de uma biblioteca.

---

## D-013 — Relatórios como definição de colunas/linhas + exportador
**Data:** 30/09/2026
**Decisão:** cada relatório produz um `{ key, title, columns[], rows[], summary }`
neutro; a serialização fica em `shared/reporting/csv.ts`. CSV usa UTF-8 com BOM e
separador `;` (compatibilidade com Excel pt-BR).
**Contexto:** o produto pede CSV agora e XLSX no futuro.
**Consequências:** adicionar XLSX é implementar outro exportador sobre a mesma
estrutura, sem tocar na lógica de negócio dos relatórios.

---

## D-014 — Importação CSV em duas etapas, sem estado no servidor
**Data:** 30/09/2026
**Decisão:** `preview` e `commit` recebem o mesmo arquivo por multipart; o `commit`
**revalida do zero** e importa apenas as linhas válidas, gravando cada registro com
auditoria (`origin: import`). E-mails já cadastrados e certificações já em vigor são
tratados como **erro de linha** (não sobrescrevem nada).
**Contexto:** o produto exige validação antes de gravar; evitar complexidade de jobs
de importação persistidos no MVP.
**Consequências:** fluxo simples e sem tabela extra; o usuário reenvia o arquivo na
confirmação. Um endpoint de "prévia assinada" (staging) pode ser adicionado depois se
o volume exigir.

---

## D-015 — Renovação explícita de certificação (`renew`)
**Data:** 30/09/2026
**Decisão:** o vínculo profissional↔certificação aceita a flag opcional `renew`.
Sem ela, criar uma linha enquanto existe outra **em vigor** da mesma certificação para
o mesmo profissional continua sendo `409 Conflict`. Com `renew: true`, a API cria a nova
linha e **encerra a anterior na véspera da data de obtenção informada** (preservando o
histórico), tudo em uma transação; a data informada precisa ser posterior à do registro
vigente. Uma linha vencida pode ser seguida por outra linha comum, sem a flag.
**Contexto:** a D-004 diz que renovação gera nova linha, mas a regra de duplicidade
impedia renovar antes do vencimento — o objetivo do histórico só se realizava depois de
a certificação expirar.
**Consequências:** renovação antecipada passa a ser possível e auditável (o log registra
o encerramento com `supersededBy: renewal`); uma constraint única parcial pode reforçar a
regra no banco no futuro.

---

## D-016 — Endurecimento de autenticação e transporte
**Data:** 30/09/2026
**Decisão:** (a) o login tem limitador de tentativas **falhas** por IP + e-mail
(`AUTH_LOGIN_MAX_ATTEMPTS`, padrão 5 em produção e 10 em desenvolvimento, janela de
`AUTH_LOGIN_WINDOW_MINUTES`), respondendo `429` ao exceder; (b) o reuso de um refresh
token já rotacionado revoga **todas** as sessões do usuário; (c) a API envia headers de
segurança via Helmet; (d) em produção os segredos JWT precisam ter ≥ 32 caracteres e ser
distintos entre si, sob pena de a aplicação não subir.
**Contexto:** achados de QA da Fase 8 (força bruta, reuso de token, segredos fracos,
ausência de headers).
**Consequências:** o limitador é em memória (múltiplas réplicas exigem store
compartilhado, ex.: Redis); o `429` é contado apenas sobre falhas, para não bloquear
logins legítimos.

---

## D-017 — Indicadores de certificação restritos a profissionais ativos
**Data:** 30/09/2026
**Decisão:** os KPIs de certificação do dashboard (totais, distribuição de status e
alertas) consideram apenas certificações de profissionais **ativos**, alinhados ao
cálculo de cobertura (D-010). A lista "próximos vencimentos" traz apenas certificações
em `EXPIRING`, dentro da janela configurada.
**Contexto:** divergência encontrada na QA: a cobertura excluía inativos, mas os KPIs e a
lista de vencimentos os incluíam, e a lista exibia certificações ACTIVE distantes do
vencimento.
**Consequências:** números coerentes entre dashboard, relatórios e cobertura;
profissionais desativados permanecem no histórico e na auditoria.

---

## D-018 — Robustez de dados: CSV, datas e erros
**Data:** 30/09/2026
**Decisão:** (a) a exportação CSV neutraliza células que começariam com fórmula
(`=`, `+`, `@`, tabulação) prefixando `'`; (b) o importador aceita apenas
`YYYY-MM-DD` ou `DD/MM/YYYY` e rejeita datas de calendário inexistentes; (c) DTOs de
data usam validação estrita (`@IsDateString({ strict: true })`); (d) erros de validação
do Prisma são devolvidos como `400 VALIDATION_ERROR` (nunca `500`) e os detalhes de
validação vêm em `error.details`; (e) cada linha importada é gravada junto com sua
auditoria na mesma transação.
**Contexto:** achados de QA da Fase 8 (CSV injection, datas ambíguas normalizadas pelo
JavaScript, `500` indevido, registro sem auditoria em falha).
**Consequências:** relatórios podem ser abertos com segurança em planilhas; importações
reportam erro por linha em vez de falhar em silêncio.

---

## D-019 — Autoatendimento do CONSULTANT: permissão contextual, mesma tela
**Data:** 30/09/2026
**Decisão:** não existe uma segunda tela nem um segundo módulo de API. O CONSULTANT usa a
**mesma página de perfil** (`/profissionais/:id`, para onde já é redirecionado no login) e
passa a poder **manter integralmente os próprios vínculos de certificação** — criar,
editar dados (datas, nº, comprovante, observações), renovar e remover. A regra de escopo
continua concentrada em `assertProfessionalAccess`, já chamado em todas as operações
aninhadas: para o CONSULTANT, qualquer `:id` que não seja o seu resulta em `403`.
ADMIN/MANAGER mantêm poder irrestrito; edição de cadastro (nome, papel, status, e-mail),
criação de profissionais e áreas de gestão (lista, dashboard, roadmap board, relatórios,
importação) seguem exclusivas de ADMIN/MANAGER.
**Contexto:** o objetivo é ter "a tela do gerente" com acesso total e, para o consultor,
uma visão restrita às coisas dele — sem duplicar telas nem reestruturar o app.
**Consequências:** mudança mínima (relaxar o `@Roles` das três rotas aninhadas +
`canEditProfessional` no frontend); toda ação do consultor fica auditada com o próprio
`actorId`, então o gerente enxerga quem alterou o quê. Objetos futuros (treinamentos,
cursos) entram no mesmo padrão: rota aninhada + `assertProfessionalAccess` + aba no perfil.

---

## D-020 — Tec News: ingestão híbrida de canais oficiais + curadoria
**Data:** 01/10/2026
**Decisão:** o módulo **Tec News** reúne novidades dos fabricantes por duas vias
complementares: (a) **ingestão automática** de feeds RSS/Atom oficiais, por um
sincronizador agendado (`NewsSyncScheduler`, com `setInterval` nativo — sem cron nem
dependência de biblioteca) que busca cada `NewsSource` ativa, faz um **parse tolerante**
próprio (`feed-parser.ts`, sem dependência externa), deduplica pela URL (única) e
classifica o tipo por palavras-chave (`news-classifier.ts`); e (b) **curadoria manual**
(ADMIN/MANAGER) para canais sem feed ou para destacar algo relevante. A ingestão é
**opt-in** (`NEWS_SYNC_ENABLED`, desligada por padrão) e há também disparo manual. O
estado de **leitura/salvo é por usuário** (`NewsReadState`); itens usam soft delete
(`hidden`); toda escrita é auditada. Os itens guardam **resumo do feed + link oficial**
(sem baixar a página inteira) e vinculam-se a um `Vendor` e, opcionalmente, a uma
`Technology`.
**Contexto:** acompanhar releases, novas certificações, funcionalidades e avisos de
segurança das tecnologias estudadas (Red Hat, Nutanix, Veeam, ExaGrid, SUSE) sem garimpo
manual, mas sem acoplar o MVP a serviços de terceiros nem inflar dependências. Os cinco
fabricantes têm feed oficial (blog/news) — inclusive ExaGrid.
**Consequências:** passa a existir tráfego HTTP **de saída** opcional para os fabricantes
(desligável; a curadoria e o resumo funcionam sem internet). A classificação por
palavras-chave é substituível por IA no futuro (o campo `kind` é a interface). Sem
dependência nova de parser nem de scheduler. Uma fonte com erro não interrompe as demais:
o motivo fica em `last_error` e o resumo da sincronização lista as falhas. URLs de feed
são administráveis (mudam com o tempo). O parser cobre os campos essenciais (título, link,
id, resumo, autor, data) e ignora entradas malformadas.

---

## D-021 — Releases: changelog do sistema dentro do aplicativo
**Data:** 01/10/2026
**Decisão:** criar a área **Releases**, um changelog do próprio sistema mantido no
banco (`Release` + `ReleaseItem`) e gerenciável por **ADMIN/MANAGER**. Cada release tem
versão (`X.Y.Z`, única), título, resumo, data, flag `current` (a versão em uso) e itens
categorizados (`FEATURE | IMPROVEMENT | FIX | SECURITY | INFRA | OTHER`). **Exatamente
uma** release pode ser a atual; definir uma nova desmarca as demais. Acesso restrito à
gestão; soft delete (`hidden`); toda escrita auditada. A versão exibida no rodapé da
navegação acompanha a release atual (constante `APP_VERSION` no frontend).
**Contexto:** faltava, dentro do app, um lugar que explicasse e documentasse o que mudou
em cada versão — para a gestão consultar sem depender do repositório/git.
**Consequências:** o histórico deixa de viver só no git/docs e passa a ser conteúdo
gerenciável, com renderização amigável (timeline por versão, itens agrupados por
categoria). A constante `APP_VERSION` precisa ser atualizada junto com a release marcada
como atual — pequena duplicação consciente, para exibir a versão sem uma chamada extra.
O seed popula o histórico real (0.1.0 → 0.3.0). Não altera o comportamento dos demais
módulos.

---

## Premissas de baixo impacto (adotadas)

- `professional_type`: CLT, PJ, INTERN, PARTNER, TEMPORARY.
- `seniority`: JUNIOR, MID, SENIOR, SPECIALIST, LEAD.
- `partnership_level`: texto livre (níveis variam por fabricante).
- Limiar de expiração padrão: 90 dias (configurável por env).
- Fuso de negócio: `America/Sao_Paulo` (configurável).

## Pendências a decidir (médio impacto)

- Nenhuma pendência aberta no MVP. A lista de campos que o **CONSULTANT** pode editar em
  si mesmo foi resolvida pela **D-019** (mantém os próprios vínculos de certificação;
  cadastro e áreas de gestão seguem com ADMIN/MANAGER).
