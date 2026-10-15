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
adicionado depois sem quebrar o campo existente. (Revisitada pela **D-025**, que
adicionou o upload do PDF mantendo o `proof_url`.)

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

## D-022 — Tec News: relevância e resumo inteligente (destaques para o consultor)
**Data:** 01/10/2026
**Decisão:** o Tec News passa a priorizar o que interessa ao consultor — **funcionalidades
de produto** e **certificações/treinamentos técnicos** — em duas camadas. (a) **Relevância
determinística** (`news-relevance.ts`, sempre ativa): pontua cada novidade de 0 a 100 a
partir de palavras-chave (PT/EN), do tipo editorial (`kind`) e da recência, atribuindo um
`NewsFocus` (`FEATURE | CERTIFICATION | SECURITY | RELEASE | OTHER`) e um motivo curto;
calculada na ingestão, na curadoria e num **backfill idempotente** no start. (b) **Resumo
inteligente (digest):** usa um endpoint **compatível com OpenAI** (config por env:
`AI_ENABLED`, `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `AI_TIMEOUT_MS`), recebe as
novidades candidatas do período (`NEWS_DIGEST_WINDOW_DAYS`, `NEWS_DIGEST_MAX_ITEMS`) e
devolve, em JSON, um texto de resumo + até 8 destaques com foco/motivo/score. O digest é
persistido (`news_digests`, snapshot em JSON) e exibido no painel **"Destaques para o
consultor"** no topo da tela; o estado de leitura/salvo continua **por usuário**. A
geração ocorre **automaticamente** ao fim de uma sincronização com novidades novas (quando
`NEWS_DIGEST_ENABLED=true`) e **sob demanda** pela gestão (`POST /news/digest`). A
classificação heurística e o campo `kind` seguem como interface estável — a IA é um
enriquecimento opcional.
**Contexto:** o volume de novidades dos fabricantes tornava a lista um garimpo; o consultor
precisa ver rápido o que agrega conhecimento (novas capacidades e certificações), não
marketing. Era o próximo passo natural previsto na D-020 (classificação substituível por IA).
**Consequências:** passa a existir tráfego HTTP de saída opcional para o provedor de IA
(opt-in; sem ele, o Tec News segue funcionando e a relevância heurística ordena a lista).
Sem dependência nova (fetch nativo). Custo/limite controlados pela janela e pelo teto de
itens por resumo. A IA pode falhar: a API responde `503` e o módulo continua íntegro
(degrada para a heurística). Todos os resumos gerados são auditados (`news_digests`). Nova
migration `20261001150000_news_digest` (campos de relevância em `news_items` + tabela
`news_digests`). Versão exibida: `0.4.0`.

---

## D-023 — Configurações pela interface: parâmetros de IA do Tec News
**Data:** 01/10/2026
**Decisão:** os parâmetros de IA do Tec News deixam de depender só de variáveis de
ambiente e passam a ser **editáveis pela interface** (página *Configurações*), restritos a
**ADMIN**. Um armazenamento chave/valor (`app_settings`, valor em JSON) guarda as
preferências; a **chave da API é cifrada em repouso** (AES-256-GCM, chave derivada por
scrypt de `SETTINGS_ENCRYPTION_KEY` — ou do `JWT_ACCESS_SECRET` quando ausente) e **nunca é
devolvida** pela API (a resposta expõe só `apiKeySet`/`apiKeySource`). A resolução é
**banco sobrepõe ambiente**: valores salvos vencem; o que não foi salvo cai no env
(`AI_*`, `NEWS_DIGEST_*`), mantendo compatibilidade com implantações que usam só env. Novos
endpoints: `GET /settings/ai`, `PUT /settings/ai` e `POST /settings/ai/test` (teste de
conexão, devolvendo `400` com o motivo quando falha). Campos: ativar IA, URL do provedor,
modelo, chave, timeout, e as opções do resumo (gerar na sincronização, janela em dias, máx.
de itens). As alterações são auditadas sem registrar o segredo.
**Contexto:** a configuração da IA vinha só do ambiente (D-022), o que exigia editar
arquivos e reiniciar o serviço. Um operador precisa ligar/ajustar o provedor pela própria
aplicação, com teste de conexão, sem repositório nem acesso ao servidor.
**Consequências:** o segredo deixa de existir apenas em env e passa a existir (cifrado) no
banco — a tela restringe o acesso e nunca o devolve. Trocar o segredo de cifra invalida a
chave salva (basta salvá-la de novo). Um `fetch`/chamada de teste gera tráfego de saída
quando disparado pelo ADMIN (sob demanda). O módulo `news` passa a resolver a config via
`SettingsService` (assíncrono); `AiClient` foi extraído para `shared/ai` (reuso entre o
resumo e o teste). Migration `20261001180000_app_settings`; suíte ampliada (bloco 11e).

---

## D-024 — Senha provisória e troca obrigatória no primeiro acesso
**Data:** 02/10/2026
**Decisão:** ao cadastrar/atualizar um usuário com senha, o ADMIN pode marcar a senha como
**provisória** (`mustChangePassword`); com uma senha informada, a marca é ligada por
**padrão** (o ADMIN desmarca se quiser uma senha definitiva). Enquanto a marca estiver
ligada, o usuário **não acessa nenhuma área do sistema**: é levado à tela `/trocar-senha`
e a API bloqueia as demais rotas com `403` por um guard global
(`PasswordChangeRequiredGuard`, executado após o `JwtAuthGuard`). Só as rotas marcadas com
`@AllowProvisionalPassword()` seguem liberadas: `POST /auth/change-password`, `GET /auth/me`
e logout. A troca (`POST /auth/change-password`) exige a **senha atual**, grava a nova
(mínimo de 8 caracteres, diferente da atual), **limpa a marca**, **revoga todas as sessões
anteriores** (refresh tokens) e devolve um novo par de tokens. A flag viaja no JWT e no
`AuthenticatedUser`; `mustChangePassword` é privilégio de **ADMIN** (junto de `role` e
`password`). O cadastro ganhou o checkbox "Exigir troca de senha no próximo acesso" e a
lista de profissionais exibe o selo **"Senha provisória"**.
**Contexto:** o go-live exige que os consultores reais recebam um acesso inicial (login +
senha) criado pela administração e definam a própria senha no primeiro login, sem senha
compartilhada conhecida pela gestão. Era o que faltava para substituir os dados DEMO por
usuários reais com segurança.
**Consequências:** nova coluna `must_change_password` em `professionals` (migration
`20261002120000_must_change_password`, `default false`: nenhum usuário existente é afetado).
O guard não adiciona consulta ao banco (a flag já vem do `JwtStrategy`), e a revogação das
sessões exige novo login nos outros dispositivos. A definição de senha/marca continua
restrita ao ADMIN, impedindo que o próprio consultor burle a troca pela edição de perfil
(`PUT /professionals/:id` é ADMIN/MANAGER). Versão exibida: `0.5.0`.

---

## D-025 — Anexo do comprovante de certificação (PDF no servidor)
**Data:** 02/10/2026
**Decisão:** o consultor (no próprio perfil) e a gestão podem **anexar o PDF do
comprovante** a um vínculo de certificação, com substituição e remoção. O arquivo é gravado
**no disco do servidor**, em `UPLOADS_DIR/certificates` (bind mount `./data/uploads`, fora
do web root), com **nome aleatório (UUID)**; o banco guarda apenas os metadados
(`attachment_file`, `attachment_name`, `attachment_mime`, `attachment_size`,
`attachment_uploaded_at`). A leitura é feita por rota **autenticada**
(`GET /professionals/:id/certifications/:recordId/attachment`), nunca por URL pública, e
segue o escopo do **D-019** (CONSULTANT só nos próprios vínculos). Só **PDF**: valida
`Content-Type`, a assinatura `%PDF-` e o limite `MAX_UPLOAD_MB` (padrão 10 MB; teto rígido
de 50 MB no multipart). Ao substituir, o arquivo anterior é apagado; ao remover o vínculo, o
anexo é apagado junto. O campo `proof_url` (link externo, D-005) **permanece** como
alternativa. O backup do banco passou a arquivar também a pasta `data/`.
**Contexto:** os comprovantes eram apenas um link externo (D-005), o que dependia de um
serviço de terceiros e não garantia a guarda do documento. O usuário pediu que o consultor
possa anexar o PDF e que os arquivos fiquem numa área persistente e segura do próprio
servidor.
**Consequências:** nova migration `20261002150000_certification_attachment` (5 colunas
nullable: nenhum registro existente é afetado). Aparece **estado em disco** a versionar/backup
(o bind mount resolve a persistência entre recriações de container). Endpoints multipart e
de streaming (`StreamableFile`), com rota autenticada em vez de estático. `UPLOADS_DIR`
(padrão `uploads`) e `MAX_UPLOAD_MB` (1–50, padrão 10) entram no `.env`. O go-live
(`clear-data.js`) apaga a pasta de certificados junto dos dados. Versão exibida: `0.6.0`.

---

## D-026 — Roadmap próprio do consultor (autoatendimento + anexo no item)
**Data:** 02/10/2026
**Decisão:** o **CONSULTANT** passa a ser dono do próprio **roadmap** — o registro da sua
evolução (o que tirou ou pretende tirar). Ele vê e mantém **somente os itens dele**, na
**mesma aba Roadmap do próprio perfil** (`/profissionais/:id`), podendo **criar, editar,
mudar o status e remover** itens, e **anexar o PDF do comprovante** ao item — no cadastro/
edição ou depois, com substituição e remoção. O item de roadmap é o registro único para
certificação, renovação, curso, treinamento, projeto e laboratório (o enum `RoadmapType` já
cobria esses casos), então **não há entidade nova** de treinamento. O **catálogo**
(fabricantes, tecnologias, certificações) e o **cadastro de profissionais** seguem
exclusivos de **ADMIN/MANAGER**; o board global `/roadmap` continua da gestão
(ADMIN/MANAGER), que também enxerga e edita o roadmap de qualquer profissional. Roadmap e
vínculo de certificação ficam **independentes** nesta entrega (o roadmap é o plano/evolução;
o vínculo é a credencial concreta).
**Contexto:** a D-019 deu ao consultor o autoatendimento apenas dos vínculos de certificação;
o roadmap (que representa "o que ele tirou ou vai tirar", incluindo treinamentos e cursos)
continuava exclusivo da gestão. O usuário pediu que cada consultor seja dono do próprio
roadmap e registre a própria evolução, com o comprovante anexado no momento do cadastro.
**Consequências:** segue o padrão da D-019 — **sem tela nem módulo de API novo**: rotas
aninhadas `POST/PUT/PATCH/DELETE /professionals/:id/roadmap[/:itemId]` e
`POST/GET/DELETE .../attachment`, com escopo garantido por `assertProfessionalAccess`
(qualquer `:id` diferente do seu → `403`) e o `professionalId` fixado pela rota (não é
possível mover o item para outro profissional). Nova migration
`20261002180000_roadmap_attachment` (5 colunas nullable em `roadmap_items`). O armazenamento
de anexos passou a ser **por pasta** (`UPLOADS_DIR/certificates` e `UPLOADS_DIR/roadmap`),
reutilizando o `AttachmentStorageService` e a validação de PDF compartilhada; o download
continua por rota autenticada e o go-live (`clear-data.js`) apaga as duas pastas. Suíte de
aceite ganha o **bloco 11h** (14 verificações; total **174**) e o smoke passa a checar o
roadmap. Versão exibida: `0.7.0`.

---

## D-027 — Visão do CONSULTANT: roadmap em destaque, catálogo oculto
**Data:** 02/10/2026
**Decisão:** o **CONSULTANT** passa a ter a entrada **"Meu roadmap"** na navegação (e é para lá
que é direcionado após o login), onde cria/edita os próprios objetivos e anexa os comprovantes.
**Fabricantes, Tecnologias e Certificações deixam de aparecer para o CONSULTANT** — tanto no
menu lateral quanto nas abas do perfil, que passa a exibir apenas **Resumo, Roadmap e
Histórico**. A gestão (ADMIN/MANAGER) mantém todas as áreas e continua acessando o perfil
completo (incluindo Certificações/Tecnologias).
**Contexto:** a D-026 colocou o roadmap na aba do perfil, mas o consultor continuava vendo os
cadastros de catálogo no menu (Fabricantes/Tecnologias/Certificações) e as abas Certificações/
Tecnologias, e o roadmap não tinha entrada na navegação. O usuário reforçou que o consultor
deve trabalhar **apenas o próprio roadmap**, com o catálogo restrito à gestão.
**Consequências:** mudança de **navegação/UX (frontend)** — **sem alteração de API e sem
migration** (o backend já escopava o roadmap por dono e já restringia a escrita do catálogo).
A **leitura** do catálogo continua liberada ao autenticado porque o formulário de roadmap usa
essas opções (certificação/tecnologia/fabricante). Como a aba **Certificações deixa de ser
exibida ao CONSULTANT**, o autoatendimento do vínculo de certificação (D-019) e do anexo do
vínculo (D-025) passam a ser **exclusivos de ADMIN/MANAGER**; o consultor registra a evolução
e o comprovante **no item de roadmap (D-026)**. Versão exibida: `0.7.1`.

---

## D-028 — Roadmap do consultor em Kanban/Timeline + painel de consultores
**Data:** 02/10/2026
**Decisão:** (a) o roadmap do consultor (área "Meu roadmap" e aba Roadmap do perfil) passa a
ter as visões **Lista, Kanban e Timeline**, com o mesmo desenho da área de gestão; no Kanban,
**arrastar** o cartão muda o status (gravando pelo endpoint do próprio profissional). (b) A
área de **Relatórios** ganha a aba **Consultores**: um **card por CONSULTANT ativo** com
contadores rápidos (abertos, atrasados, total); ao **clicar**, abre uma **janela flutuante**
com os itens do roadmap daquele consultor resumidos (título, tecnologia/certificação, tipo,
prioridade, status, prazo/atraso e se tem anexo).
**Contexto:** a D-026/D-027 deram ao consultor o próprio roadmap, mas apenas na visão de
lista, e a gestão não tinha uma visão consolidada por consultor. O usuário pediu Kanban/
Timeline para o consultor e cards por consultor em Relatórios, com o detalhe em janela
flutuante.
**Consequências:** novo endpoint **`GET /reports/consultants`** (ADMIN/MANAGER) que devolve,
numa **única chamada**, os consultores ativos com `stats` e a lista resumida de itens —
evita N requisições no frontend. **Sem migration.** Os componentes de Kanban/Timeline passam
a aceitar `items` (modo controlado), reaproveitando o mesmo desenho com os dados do
profissional. A suíte ganha 3 verificações (bloco 9; **177** no total) e o smoke passa a
checar o painel. Versão exibida: `0.7.2`.

---

## D-029 — Módulo Tickets: medições mensais a partir de chamados do Zoho Desk (espelho)
**Data:** 09/10/2026
**Decisão:** criar o módulo **Tickets**, que **espelha (somente leitura)** os chamados do
**Zoho Desk** para o banco local e gera **Medições Mensais** — um relatório por cliente que
consolida os chamados atendidos/faturados no mês, servindo de **comprovação formal de serviço
para faturamento**. O módulo fica **desligado por padrão** (`TICKETS_ENABLED=false`) e a
sincronização com o Zoho é **opt-in** (`ZOHO_SYNC_ENABLED=false`), no mesmo padrão do
`NEWS_SYNC_ENABLED`. O acesso é restrito a **ADMIN/MANAGER** (o CONSULTANT não acessa).
Entrega incremental em 8 fases: 0 baseline/ADR, 1 banco (Prisma), 2 CRUD interno (Clients/
Tickets), 3 integração Zoho (sync espelhado), 4 medições mensais, 5 frontend, 6 exportação
CSV/PDF, 7 QA/documentação e 8 release controlado.
**Contexto:** o Gerente de Serviços precisa comprovar formalmente o serviço prestado por
cliente/mês para faturar; hoje essa consolidação é manual. Os chamados já existem no Zoho Desk
e devem ser reunidos **localmente** (sem depender de consulta ao Zoho no fechamento), para
permitir medição reprodutível, auditável e exportável.
**Premissas (algumas a confirmar na Fase 1/4):**
- Modelos `Client` (1:N com `Ticket`) e `Ticket` (espelho do Zoho; `zohoTicketId` **único**);
  `clientId` é FK obrigatória de `Ticket` com `onDelete: Restrict`.
- Datas em **UTC**; o "mês da medição" é interpretado em `BUSINESS_TIMEZONE`
  (`America/Sao_Paulo`). **Critério de mês proposto (a confirmar antes da Fase 4):** o chamado
  entra na medição do mês pela **`closeDate`** (encerrado no mês) e apenas quando
  `isBillable=true`.
- `status` é guardado como **texto livre** (o Zoho muda rótulos) + `statusType`; não vira enum.
- `slaCompliant` **nullable** (o Zoho pode não calcular SLA).
- Chamados sem `Client` mapeado vão para uma fila de **"não mapeados"** (não se adivinha o
  cliente nem se perde o chamado).
- Escrita sempre auditada; medição **FECHADA é imutável** (reabertura só ADMIN, com auditoria
  e justificativa), com **snapshot** dos chamados no fechamento.
**Consequências:** o módulo é **aditivo e retrocompatível** — nada muda nos modelos/rotas
existentes e nenhum dado é removido. A primeira migration cria `clients` e `tickets`. Segredos
do Zoho só por variável de ambiente ou pela tela de Configurações (cifrados, nunca devolvidos).
O snapshot da medição evita que uma nova sincronização altere um fechamento já faturado. As
flags (`TICKETS_ENABLED`/`ZOHO_SYNC_ENABLED`) permitem desligar o módulo e o sync sem alteração
de código. Versão prevista: `0.8.0`.

---

## D-030 — Integração Zoho Desk configurável pela interface + Relatórios de Chamados
**Data:** 13/10/2026
**Decisão:** habilitar a **configuração da integração com o Zoho Desk pela interface**
(ADMIN) — data center, Client ID/Secret, orgId, escopos, campo de "Tecnologia", origem do
cliente (Account/Contact), status considerados "fechado", frequência de sincronização e o
fluxo **OAuth 2.0 (Authorization Code)** — **sobre a base do módulo Tickets (D-029)**, e
entregar os **Relatórios de Chamados**: um **Relatório Financeiro** (faturamento) e um
**Relatório do Cliente** (atendimento, **sem valores de contrato**). Entrega incremental em
fases (0–10), versão prevista `0.9.0`.
**Contexto:** a D-029 espelha os chamados e gera Medições Mensais, mas (a) as credenciais vêm
**só** de variável de ambiente e não há tela de configuração/teste; (b) o tempo é **agregado**
por chamado, sem os **lançamentos por agente** (`/timeEntries`); (c) não existem **contrato/
franquia** nem relatórios de atendimento. O Gerente de Serviços precisa configurar/conectar o
Zoho pela própria aplicação e produzir, por cliente/mês, tanto a comprovação de faturamento
(Financeiro) quanto um relatório de atendimento profissional (Cliente).
**Decisões confirmadas:**
1. **Credenciais**: passam a ser **editáveis pela interface e cifradas em repouso**
   (AES-256-GCM, mesma infra da D-023), com **fallback para env** (banco sobrepõe ambiente).
   Client Secret e Refresh Token **nunca** são devolvidos (só `clientSecretSet`/
   `refreshTokenSet`). Isto **evolui** a postura "só env" da D-029 — que **segue válida** para
   o espelho/medição quando não há nada salvo na tela.
2. **Relatório Financeiro** = **evolução da Medição Mensal (D-029)**, **não** um módulo
   paralelo: a medição ganha **contrato** (franquia/valores/política de saldo), a **regra de
   faturamento** e o **e-mail** (HTML+texto, `.eml`, PDF).
3. **Papéis**: **não** se cria papel `FINANCEIRO`. **ADMIN** edita Configurações e
   **ADMIN/MANAGER** geram os relatórios (o **CONSULTANT** não acessa o módulo).
4. **Gráficos** (B5): desenhados **sem dependência nova** — vetoriais no PDF (gerador próprio
   da D-029) e em **SVG** no HTML.
5. **Tempo**: passa a haver **lançamentos** (`time_entries`) importados de
   `GET /tickets/{id}/timeEntries`; `Ticket.timeSpentMinutes` **permanece** como **soma** dos
   lançamentos (compatível com a medição existente).
**Modelo de dados (aditivo):**
- `Contract`: cliente, nome do plano, `includedMinutes`, `monthlyValue`, `extraHourValue`,
  `balancePolicy` (`EXPIRE | ACCUMULATE`), vigência (`startDate`/`endDate`) e `financeEmail`.
- `TimeEntry`: `ticketId`, `zohoTimeEntryId` (único), `ownerId`, `executedAt`, `minutes`
  (inteiro, convertido de horas/min/seg), `description`, `isBillable`.
- `GeneratedReport`: cliente, período, `type` (`FINANCIAL | CLIENT`), status de faturamento,
  arquivo/anexo, `generatedAt`/`generatedBy`, `sentAt`/`sentTo`.
- `Ticket`: campos **opcionais** novos `contactId`, `departmentId`, `accountId`, `accountName`,
  `assigneeId` e `technologyName` (normalizado).
- `AppSetting`: chaves novas `zoho` (credenciais cifradas + preferências), `branding`
  (identidade visual) e `email` (SMTP/Graph).
**Configuração Zoho (A):**
- Data center define os domínios: `api = https://desk.zoho.{dc}/api/v1`
  (`au` → `desk.zoho.com.au`, `jp` → `desk.zoho.jp`) e `oauth =
  https://accounts.zoho.{dc}/oauth/v2/token`; a **Redirect URI** é **derivada** (somente leitura).
- **Testar conexão**: `GET /tickets?limit=1`, com erro **detalhado** (orgId/escopo/domínio/
  credencial).
- **Conectar com Zoho** (Authorization Code) grava o **refresh token cifrado**; **Desconectar**
  apaga as credenciais; **Sincronizar agora** dispara o sync.
- **Rate limit**: paginação `from`/`limit`, **backoff exponencial** em `429`/`5xx`,
  **refresh automático** do access token e **1 retry** em `401`.
- **Log de sincronização** (data/hora, quantidade, erros) visível em Configurações;
  **incremental por `modifiedTime`**; **upsert pelo id interno** do chamado no Zoho.
**Relatórios (B):** métricas B2 (fechados por `closedTime` no período; abertos = status
não-fechado na **data final** **+** criados no período; horas por lançamento por `executedTime`;
horas e chamados por tecnologia; tempo médio de solução = `closedTime − createdTime`) e regra
B3 (`adicionais = max(0, horas − franquia)`; `PADRÃO`/`COM HORAS ADICIONAIS`;
`total = mensal + adicionais × valor_hora`; saldo considerado conforme a política do contrato).
**Financeiro (B4):** assunto e formatos exatos, tabela, bloco de status, **anexo PDF** e ações
**Copiar / Baixar `.eml` / Enviar** (o envio exige **confirmação explícita**). **Cliente (B5):**
HTML **e** PDF com **identidade visual**, KPIs, barra de franquia, gráficos, campos editáveis
("principais atuações" e recomendações), tabela detalhada e rodapé, em **A4 com cabeçalho
repetido** e **sem valores** do contrato. **Interface (B6):** lista com filtros, reabrir,
baixar e reenviar; prévia na tela; **alertas** (fechado sem horas, sem tecnologia, cliente sem
contrato) com link para corrigir.
**Regras não-funcionais:** fuso **`America/Recife`** nos cálculos (`BUSINESS_TIMEZONE`);
**auditoria** de quem gerou/enviou; **testes unitários** das regras B2/B3 (abaixo/igual/acima
da franquia, sem horas, chamado que cruza o período); camada Zoho **isolada** (trocável por
outro ITSM no futuro).
**Consequências:** módulo **aditivo e retrocompatível** — nenhum modelo/rota existente muda e
nenhum dado é removido; migrations aditivas com `down.sql`. Novos segredos **cifrados em
repouso** (JSON em `app_settings`, mesma cifra da D-023). **Sem dependência nova** (fetch
nativo, PDF/SVG próprios). As flags `TICKETS_ENABLED`/`ZOHO_SYNC_ENABLED` continuam valendo e a
tela de Configuração só é editável por **ADMIN**. Versão prevista: `0.9.0`.

---

## D-031 — Fila de não mapeados: vínculo em lote, auto-limpeza e nome da conta
**Data:** 13/10/2026
**Decisão:** aprimorar a **fila `unmapped_tickets`** (D-029/D-030) em três pontos, sem novas
telas nem quebra de contrato: (1) **vínculo em lote** — vincular **todos os chamados de uma
conta** do Zoho ou **as linhas selecionadas** de uma vez; (2) **auto-limpeza** — ao mapear um
chamado (cliente passou a existir ou foi vinculado), **remover** a linha correspondente da fila;
(3) **nome da conta** — resolver o `accountName` sob demanda (`GET /accounts/{id}`), pois a
listagem de chamados devolve só o `accountId`.
**Contexto:** no primeiro uso real, a sincronização trouxe 199 chamados de 5 contas e **todos**
caíram na fila (nenhum cliente cadastrado ainda) — o que é o comportamento correto, mas (a) o
vínculo era **um a um** (199 cliques), (b) a fila **não se limpava** quando o cliente passava a
existir e (c) as linhas mostravam **apenas o id** da conta. Ajustes pequenos resolvem a operação
sem redesenhar o fluxo.
**Decisões:**
1. **API aditiva**: `GET /tickets/unmapped/groups` (agrupamento por conta) e
   `POST /tickets/unmapped/link` (`{ clientId, accountId? , ids? }`; exatamente um dos dois).
   O vínculo individual (`POST /tickets/unmapped/:id/link`) **permanece**.
2. **Idempotência preservada**: o lote reaproveita o mesmo `linkRow` do vínculo individual
   (upsert por `zohoTicketId`) e remove a linha da fila ao final.
3. **Auto-limpeza no sync**: quando o cliente passa a existir (ou o chamado já estava mapeado),
   a linha obsoleta da fila é removida.
4. **Nome da conta**: consultado **uma vez por conta e por execução** (cache em memória);
   falha isolada **não** interrompe o sync (a linha fica com o id).
5. **Papéis**: as rotas seguem **ADMIN**; a interface mantém o seletor de cliente de destino.
**Consequências:** mudança **aditiva e retrocompatível** (nenhum modelo/prisma-migration; só
rotas e lógica de serviço). Fila "suja" deixa de ocorrer; a operação vira poucos cliques por
conta. **Sem dependência nova.** Versão: `0.9.1`.

---

## D-032 — Lançamentos de tempo: endpoint correto e reimportação
**Data:** 13/10/2026
**Decisão:** corrigir a leitura dos **lançamentos de tempo** do Zoho Desk, espelhá-los também no
**vínculo pela fila** e oferecer uma ação de **reimportação** para os chamados já espelhados.
**Contexto:** no uso real, o chamado **#626** tinha **4 lançamentos (5h)** no Zoho, mas o espelho
mostrava **0 minutos**. Duas causas: (a) o cliente HTTP usava `/tickets/{id}/timeEntries`
(**plural**), que o Zoho responde **404** — o correto é **`/timeEntry`** (singular); a falha era
**silenciosa** (`afterTicketWrite` captura o erro e mantém o tempo atual); (b) o caminho de
**vínculo pela fila** (`linkRow`, D-031) **não** chamava `afterTicketWrite`, então chamados
vinculados manualmente nunca buscavam os lançamentos.
**Decisões:**
1. **Endpoint** `/tickets/{ticketId}/timeEntry` (singular), mantendo a paginação `from`/`limit`.
2. **Vínculo pela fila** (`linkRow`) passa a chamar `afterTicketWrite` (espelha os lançamentos).
3. **Reimportação**: `POST /tickets/sync/time-entries` (ADMIN) reimporta os lançamentos de todos
   os chamados espelhados (limite `ZOHO_MAX_TICKETS_PER_RUN`); botão **"Atualizar horas"** na tela.
4. **Nome do agente**: `ownerName` resolvido via `GET /agents/{id}` (`firstName`+`lastName`),
   com cache por execução; falha isolada **não** derruba o sync.
**Consequências:** aditivo e retrocompatível (sem migration). `timeSpentMinutes` volta a ser a
**soma real** dos lançamentos; medições e relatórios passam a ter horas. Versão: `0.9.2`.

---

## D-033 — Menu lateral em submenus: Catálogo e GSS Qualidade
**Data:** 15/10/2026
**Decisão:** o menu lateral deixa de ser uma **lista plana** e passa a agrupar os itens
relacionados em **submenus retráteis** (acordeão): **"Catálogo"** (Profissionais, Fabricantes,
Tecnologias, Certificações) e **"GSS Qualidade"** (Clientes, Tickets, Medições, Contratos,
Relatórios de Chamados).
**Contexto:** com os módulos pós-MVP, o menu chegou a **13 itens** e ficou visualmente longo,
dificultando a leitura e empurrando itens para baixo da dobra em telas menores. Os itens de
Tickets/Chamados (D-029/D-030) já formavam um bloco coeso (o módulo "GSS Qualidade" — Gestão de
Serviços de Suporte), e o catálogo de cadastros forma outro. Agrupá-los reduz a altura sem
esconder nenhuma área.
**Decisões:**
1. **Modelo de navegação** aditivo em `layouts/navigation.ts`: novo tipo `NavGroup` (com `label`,
   `icon`, `roles` e `children: NavItem[]`); `NavItem` permanece igual. `NavEntry = NavItem | NavGroup`
   e o helper `isNavGroup` faz o estreitamento de tipo.
2. **Visibilidade por papel preservada**: `visibleNavItems` filtra as folhas por papel e **descarta
   o grupo inteiro** quando nenhum filho é visível (ex.: o CONSULTANT não vê o Catálogo).
3. **Comportamento (recomendado)**: o submenu **abre automaticamente** quando a rota atual pertence
   a ele (via `useLocation`), tem **chevron com `aria-expanded`** e **lembra o estado** aberto/fechado
   durante a sessão; no **drawer mobile** o comportamento é idêntico.
4. **Escopo**: apenas o agrupamento (Catálogo e GSS Qualidade). Demais itens (Dashboard, Tec News,
   Roadmap/Meu roadmap, Relatórios, Releases, Configurações) seguem soltos nesta entrega.
5. **Sem backend**: ajuste **exclusivamente de frontend** — sem migration, endpoint ou permissão
   nova; a autorização continua no backend (as rotas do grupo já eram ADMIN/MANAGER).
6. **Consistência da suíte**: a contagem de releases do estado DEMO no `scripts/acceptance.sh`
   foi **corrigida de 13 para 16** (o seed já produzia mais releases do que o aceite esperava —
   defasagem anterior a esta entrega).
**Consequências:** menu mais curto e legível; nenhuma funcionalidade escondida (só aninhada);
mudança puramente visual, retrocompatível e sem dependência nova. **Versão: `0.9.3`.**

---

## D-034 — Sincronização de chamados: cursor de paginação e busca paralela
**Data:** 15/10/2026
**Decisão:** substituir o **watermark por `modifiedTime`** da sincronização do Zoho Desk por um
**cursor de paginação por offset persistido** (`app_settings.zoho_sync.cursorFrom`), que avança a
cada execução e **reinicia ao chegar ao fim** da listagem; buscar os **lançamentos de tempo em
paralelo** (concorrência limitada) e elevar o teto por execução para 1000; e **aumentar o
`proxy_read_timeout` do nginx** para 300 s na rota `/api/`.
**Contexto:** no uso real, o espelho **parava nos primeiros ~200** chamados (a base tem **~611**)
e a sincronização terminava com **erro** no navegador. Investigação na API do Zoho Desk mostrou
que a **listagem** (`GET /tickets`) **não devolve `modifiedTime`** (retorna `createdTime`,
`closedTime`, etc.), então o mapper gravava `zohoModifiedAt = null` em todos, o estado salvava
`lastModifiedAt: null` e a sincronização **reenviava sempre `from=0..200`** — nunca avançava.
Além disso, cada chamado faz **1 chamada a `/tickets/{id}/timeEntry`** (D-032), e a execução
sequencial de 200 chamados levava **~173 s** — acima do `proxy_read_timeout` **padrão do nginx
(60 s)**, que devolvia **504** ao navegador enquanto o backend concluía com **0 erros**.
**Decisões:**
1. **Cursor de paginação** (`cursorFrom`, `cursorComplete`): a sincronização percorre a listagem
   por offset, avança o cursor até o teto por execução e o reinicia ao encontrar uma página
   incompleta (fim do conjunto). O **incremental por data é abandonado** — a API não expõe um
   campo de modificação confiável; cada varredura completa mantém o espelho atualizado.
2. **Busca paralela** dos lançamentos de tempo (`mapWithConcurrency`, concorrência **4**),
   preservando a correção (busca sempre as horas; **não** se pula por heurística, para não
   arriscar o faturamento). Mantém-se sob o limite de requisições da API do Zoho.
3. **Teto por execução** (`ZOHO_MAX_TICKETS_PER_RUN`) **200 → 1000**, para uma varredura caber
   em uma execução nas bases atuais.
4. **nginx**: `proxy_read_timeout`/`proxy_send_timeout` de **300 s** na rota `/api/`; o Sync
   continua **síncrono** (o endpoint devolve o resumo) — com o cursor e a paralelização, uma
   varredura completa cabe no tempo do proxy. A opção de sync assíncrono com progresso fica como
   evolução futura.
5. **Sem migration**: nenhum campo novo no banco; o cursor é guardado no JSON de estado
   (`app_settings`). `lastModifiedAt` fica **depreciado** (mantido só por compatibilidade).
**Consequências:** o espelho passa a conter **toda** a base (varrida ao longo de poucas
execuções) e a sincronização **termina sem erro** no navegador. Custo: sem filtro incremental,
cada varredura relê os chamados do trecho percorrido (idempotente por `zohoTicketId`). Sem
dependência nova. **Versão: `0.9.4`.**

---

## D-035 — Tickets: detalhe do chamado e re-associação de cliente
**Data:** 15/10/2026
**Decisão:** na lista de **Tickets**, abrir um **modal de detalhe** ao clicar no chamado (dados do
chamado + **lançamentos de tempo** + total de horas) e permitir ao **ADMIN** **trocar o cliente**
de um chamado já mapeado, **desassociá-lo** (devolvendo à fila de não mapeados) e **reimportar as
horas** daquele chamado.
**Contexto:** o vínculo com o cliente só existia na **fila de não mapeados** (`unmapped_tickets`);
uma vez mapeado, o chamado saía da fila e **não havia como corrigir** um vínculo errado. Também
não havia, na interface, como **ver as atividades** de um chamado (as horas apareciam só como um
total na lista) — sem visão dos lançamentos individuais (data, técnico, descrição, faturável).
**Decisões:**
1. **Re-associação**: `PATCH /tickets/:id/client` (`{ clientId }`) troca o cliente do chamado
   mapeado, mantendo o espelho e os lançamentos; remove eventuais linhas obsoletas da fila.
2. **Desassociação**: `POST /tickets/:id/unlink` **devolve** o chamado à fila (recria a linha em
   `unmapped_tickets` a partir dos campos já espelhados, para um novo vínculo não degradar os
   dados) e **remove o espelho** (os lançamentos caem em cascata; são reimportados no novo vínculo).
3. **Detalhe**: `GET /tickets/:id` passa a incluir `timeEntries` (ordenados por execução); a lista
   **não** carrega os lançamentos (mantém o payload leve).
4. **Reimportação por chamado**: `POST /tickets/:id/refresh-time-entries` (ADMIN) reusa o
   `afterTicketWrite` (D-032) para um único chamado — útil no modal.
5. **Permissão**: as três ações são **ADMIN** (mesma regra do vínculo); a **leitura** do detalhe
   segue **ADMIN/MANAGER**. Tudo **auditado**.
6. **Sem migration**: os modelos já existiam (`Ticket.clientId`, `TimeEntry`).
**Consequências:** dá para **corrigir vínculos** sem apagar dados manualmente, e a operação passa a
**enxergar as atividades** de cada chamado. `onDelete: Restrict`/`Cascade` já suportavam o fluxo.
Sem dependência nova. **Versão: `0.9.5`.**

---

## D-036 — E-mail: testar o envio antes de habilitar
**Data:** 15/10/2026
**Decisão:** permitir **testar o envio de e-mail usando os valores preenchidos no formulário**,
sem precisar salvar e **mesmo com o envio desabilitado** (`enabled=false`).
**Contexto:** o botão "Enviar teste" só habilitava quando a configuração já estava **salva e
habilitada** (`configured`), obrigando a ligar o envio (e arriscar disparos reais) antes de
saber se as credenciais funcionavam.
**Decisões:**
1. **Teste com overrides transitórios**: `POST /settings/email/test` aceita, opcionalmente, os
   **mesmos campos** de `PUT /settings/email` (`TestEmailSettingsDto extends UpdateEmailSettingsDto`);
   o backend resolve a configuração efetiva com esses valores **em memória** (nada é persistido).
2. **Separar "testável" de "habilitado"**: novo `sendable` = transporte + remetente preenchidos
   (SMTP: host+porta; Graph: tenant+clientId+secret). `configured = enabled && sendable`.
   O envio de **negócio** (Relatório Financeiro) continua exigindo `configured`; o **teste** exige
   apenas `sendable`.
3. **Frontend**: o botão "Enviar teste" envia o formulário atual (incluindo a senha/secreta digitada,
   se houver) e habilita quando o formulário está completo — não depende de salvar. Texto de ajuda
   deixa claro que o teste usa os valores acima.
**Consequências:** dá para validar SMTP/Graph **antes** de ligar o envio, reduzindo o risco de
configurar errado. Sem migration, sem dependência nova. **Versão: `0.9.6`.**

---

## D-037 — Publicação na nuvem (Azure) com Let's Encrypt
**Data:** 15/10/2026
**Decisão:** publicar o Suporte Skills num **ambiente de nuvem** (VM na Azure) com **HTTPS real
(Let's Encrypt)** terminado por um **Caddy** à frente do stack, **sem alterar** o ambiente on-prem.
**Contexto:** o on-prem roda via `docker compose` com certificado **autoassinado** e acesso só na
LAN. Na nuvem o serviço fica **exposto à internet**, então precisa de **TLS confiável** e do
**mínimo de superfície** (banco/API não expostos).
**Decisões:**
1. **Override de compose separado** — `docker-compose.cloud.yml` (usado com
   `-f docker-compose.yml -f docker-compose.cloud.yml`). O `docker-compose.yml` **não muda**, então
   o on-prem segue idêntico.
2. **Caddy como borda TLS** (`caddy:2-alpine`): emite e **renova** automaticamente o certificado
   do `DOMAIN` (desafio HTTP-01 na porta 80) e faz o proxy para o serviço `web`.
3. **`web` serve só HTTP na nuvem** (`frontend/nginx.cloud.conf`, montado sobre
   `/etc/nginx/conf.d/default.conf`): o TLS fica no Caddy (sem TLS duplicado). Mantém o proxy da API
   com os timeouts da D-034.
4. **`db`/`api`/`web` não publicam porta no host** (só a rede interna do compose) — Postgres e API
   **nunca** expostos. Usa-se `ports: !override []` (Compose moderno).
5. **Config por ambiente**: `DOMAIN`/`ACME_EMAIL` no `.env` (o `Caddyfile` usa `{$DOMAIN}`/
   `{$ACME_EMAIL}`) e `PUBLIC_API_URL`/`PUBLIC_WEB_URL` no domínio HTTPS. Exemplo em
   `.env.cloud.example`.
6. **Sem migration** e **sem dependência** no runtime da aplicação (Caddy é só um container).
**Consequências:** um segundo ambiente (nuvem) reproduzível por `git` + `docker compose` com HTTPS
válido, mantendo o on-prem intacto. Requer **DNS A** apontando para a VM e o **NSG** liberando
80/443. Documentado em **[CLOUD.md](./CLOUD.md)**. **Versão: `0.9.7`.**

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
