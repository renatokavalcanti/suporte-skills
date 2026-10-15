# QA — Fase 8

Revisão de qualidade do MVP concluída em **30/09/2026**, cobrindo os 25 critérios de
aceite do prompt mestre. Método: inspeção de código (backend e frontend), revisão de
segurança, e uma suíte de regressão automatizada de ponta a ponta.

## 1. Escopo e método

| Frente | Como foi verificado |
|--------|---------------------|
| API e regras de negócio | Suíte `scripts/acceptance.sh` — **222 verificações**, 100% aprovadas |
| Permissões (RBAC) | Matriz ADMIN/MANAGER/CONSULTANT em dashboard, cadastros, roadmap, relatórios, importação e dados de terceiros |
| Segurança | Headers (Helmet), CORS, força bruta no login, reuso de refresh token, injeção em CSV, validação de entrada, exposição de erro |
| Regras de negócio | Status dinâmico, cobertura, vencimentos, auditoria, renovação, duplicidade |
| Frontend | Inspeção de estados (loading/vazio/erro), formulários, responsividade, acessibilidade, controle de acesso por papel, sessão |
| Infra | Migration versionada, seed idempotente, `docker-compose`, documentação |

## 2. Suíte de regressão

A suíte vive no repositório: **`scripts/acceptance.sh`** (222 verificações). Ela exige a
API e o frontend no ar e o **seed DEMO aplicado**; ao final limpa os dados de teste e
reaplica o seed (`RESET_DEMO=0` desativa essa restauração).

```bash
npm run seed --prefix backend      # garante o estado DEMO
bash scripts/acceptance.sh         # 177 PASS / 0 FAIL
```

Parâmetros aceitos: `API_URL`, `WEB_URL`, `NODE_BIN`, `CURL_BIN`, `PSQL_BIN`, `NPM_BIN`,
`BACKEND_DIR`, `WORK_DIR`, `DB_USER/DB_HOST/DB_PORT/DB_NAME`, `RESET_DEMO`,
`ALLOW_DATA_LOSS`. Em Git Bash os caminhos são normalizados via `cygpath`
(node/curl/psql nativos do Windows).

> Rode sempre sobre um banco recém-semeado: dados deixados por execuções anteriores
> invalidam as verificações de volume do seed, do dashboard e da importação.

> **Proteção de dados:** com `RESET_DEMO=1` (padrão) a limpeza final **apaga todos os
> dados** e reaplica o seed. Para não destruir dados reais, a suíte **aborta antes de
> qualquer teste** ao encontrar registros fora do seed DEMO (id que não começa pelo prefixo
> do seed, ex.: `prof-`, `ven-`), a menos que `ALLOW_DATA_LOSS=1` seja informado. Em ambiente
> com dados reais, prefira `RESET_DEMO=0` ou o teste de fumaça (§2.1). Antes de apagar, a
> suíte gera **automaticamente um dump** em `backups/` (`scripts/backup-db.sh`;
> `SKIP_BACKUP=1` desativa) e **aborta se o backup falhar** com dados reais.

### 2.1 Teste de fumaça (não-destrutivo)

`bash scripts/smoke.sh` valida que a aplicação está no ar e funcional **sem criar, alterar
ou remover dados**: frontend, `/health`, login, `/auth/me`, dashboard, Tec News (lista +
resumo), configurações de IA (sem expor a chave), o roadmap da gestão e a proteção das rotas
de anexo (com leitura do próprio roadmap quando o CONSULTANT é informado). Quando o módulo
Tickets está ligado, valida leituras não-destrutivas de clientes/chamados/medições, o status
da sincronização do Zoho e o RBAC do CONSULTANT (pulado em `404` quando o módulo está
desligado). É o teste
indicado **após um deploy** em ambiente com dados reais. O **ADMIN é obrigatório**
(`SMOKE_ADMIN_EMAIL/PASSWORD`); MANAGER e CONSULTANT são **opcionais** (`SMOKE_MANAGER_*`,
`SMOKE_CONSULTANT_*`) — quando informados, o RBAC deles é exercitado; quando não, as
verificações são puladas (útil em ambiente real, onde só o ADMIN existe). Aceita também
`API_URL`, `WEB_URL`, `NODE_BIN`, `CURL_BIN` e `SMOKE_INSECURE=1` (curl `-k`).

| Bloco | Verificações |
|-------|--------------|
| 1. Autenticação | 7 |
| 2. Segurança | 6 |
| 3. Permissões (RBAC) | 10 |
| 4. Estado do seed / banco / infra / docs | 4 |
| 5. Dashboard | 7 |
| 5b. Autoatendimento do CONSULTANT (D-019) | 11 |
| 6. Cadastros | 8 |
| 7. Relacionamentos e histórico | 11 |
| 8. Roadmap | 8 |
| 9. Relatórios e CSV | 11 |
| 10. Importação CSV | 9 |
| 11. Frontend e proxy | 2 |
| 11b. Tec News (D-020) | 19 |
| 11c. Releases (D-021) | 12 |
| 11d. Tec News — resumo inteligente (D-022) | 6 |
| 11e. Configurações de IA (D-023) | 8 |
| 11f. Senha provisória (D-024) | 13 |
| 11g. Anexo do comprovante (D-025) | 10 |
| 11h. Roadmap próprio do consultor + anexo (D-026) | 14 |
| 11i. Tickets e Medições Mensais (D-029) | 20 |
| 11j. Chamados — contratos e relatórios (D-030) | 25 |
| 11k. Fila de não mapeados: vínculo em lote e limpeza (D-031) | 9 |
| 11l. Lançamentos de tempo: reimportação (D-032) | 2 |
| 12. Limpeza e restauração do seed | 1 |
| **Total** | **233** |

Suítes das fases anteriores, reexecutadas após as correções: F2 23/23, F3 15/15,
F4 16/16, F5 13/13, F7 6/6.

> A suíte da Fase 6 (PowerShell, fora do repositório) mantém 2 verificações frágeis por
> **codificação** (literais acentuados como `Concluído`/`Até 30 dias` são lidos como ANSI
> no Windows PowerShell 5.1) e por **fronteira de faixa** (um vencimento a exatamente
> 30/31 dias). Os relatórios em si respondem corretamente — validados no bloco 9 da suíte
> de aceite — e foram absorvidos por ela.

## 3. Defeitos encontrados e corrigidos

### Alta prioridade

| # | Defeito | Correção |
|---|---------|----------|
| 1 | `PUT /roadmap/:id` apagava o vínculo de certificação quando o corpo enviava apenas `technologyId` | Só altera o vínculo quando a chave é enviada explicitamente (`roadmap.service.ts`) |
| 2 | Renovação de certificação era impossível: a regra de duplicidade bloqueava a nova linha (contradizia D-004) | Nova D-015: campo `renew` encerra o registro anterior na véspera e cria a nova linha, tudo em transação |
| 3 | Login sem proteção contra força bruta | Limitador por IP + e-mail (configurável) → HTTP 429 com mensagem de espera |
| 4 | Exportação CSV permitia **CSV injection** (célula iniciando com `=`/`+`/`@`) | Prefixo `'` em valores de texto com gatilho de fórmula (`reporting/csv.ts`) |
| 5 | Reuso de refresh token não revogava a família de sessões | Reuso detectado revoga todas as sessões do usuário e retorna 401 |
| 6 | `DELETE /imports` / commit de importação gravava sem transação (registro sem auditoria em falha) | Cada linha importada é gravada + auditada em uma `$transaction` |
| 7 | Linha de importação cuja referência deixou de existir era ignorada **em silêncio** | Revalidação no commit gera erro por linha no resumo |

### Média prioridade

| # | Defeito | Correção |
|---|---------|----------|
| 8 | `upcomingExpirations` do dashboard incluía certificações ACTIVE (longe do vencimento) | Lista apenas `EXPIRING`, dentro da janela configurada |
| 9 | Indicadores de certificação contavam profissionais **inativos**, divergindo da cobertura | Métricas de certificação consideram apenas profissionais ativos |
| 10 | `assertNoOpenDuplicate` não revalidava quando só as datas mudavam; `expiresAt: null` era mascarado pelo valor antigo | Revalidação sempre que certificação **ou** datas mudam (excluindo o próprio registro); `undefined` ≠ `null` |
| 11 | Filtro `overdue` sobrescrevia o intervalo `from`/`to` (silenciosamente) | Condições combinadas com `AND` |
| 12 | `PATCH /roadmap/:id/status` reescrevia `completedAt` a cada conclusão | Preserva a data original de conclusão |
| 13 | Erros de validação do Prisma viravam 500 | Mapeados para 400 `VALIDATION_ERROR`; detalhes de validação devolvidos em `error.details` |
| 14 | Parser CSV aceitava datas ambíguas/inválidas via `new Date()` (ex.: `2026-02-30`) | Aceita apenas `YYYY-MM-DD` e `DD/MM/YYYY`, validando a existência da data |
| 15 | DTOs aceitavam datas de calendário inexistentes normalizadas pelo JS | `@IsDateString({ strict: true })` nos DTOs com data |
| 16 | `CORS_ORIGIN=""` bloqueava todo o tráfego cross-origin em vez de usar o padrão | Lista vazia cai no valor padrão |
| 17 | `POST /imports/:type/preview` respondia 201 (criação) | `@HttpCode(200)` — a prévia não cria nada |
| 18 | Segredos fracos/iguais aceitos em produção; defaults do compose ficariam fora da regra | Validação fail-fast (≥ 32 caracteres e distintos) + defaults do compose e `.env.example` ajustados |
| 19 | Frontend: rotas restritas acessíveis por URL direta (CONSULTANT via `/relatorios`, `/importar`, `/roadmap`, `/profissionais`) | Guarda de papel `RequireRole` com aviso "Acesso restrito" |
| 20 | Frontend: sessão expirada não deslogava — o usuário ficava preso em erros 401 | Interceptor avisa o `AuthProvider`, que limpa o usuário e volta ao login |
| 21 | Frontend: mesma `queryKey` para listas com filtros diferentes contaminava o cache (relatórios × roadmap) | Chaves distintas por conjunto de parâmetros |
| 22 | Frontend: timeline do roadmap cortava o conteúdo em telas pequenas | `overflow-x-auto` |
| 23 | Frontend: "Tentar novamente" na importação repetia a prévia em vez do commit que falhou | Repete a última ação que falhou |
| 24 | Frontend: página do roadmap lista não voltava à página 1 ao filtrar | Reset de página ao mudar filtros |
| 25 | Frontend: selects dependentes vazios em caso de erro de carregamento | Select desabilitado durante carregamento/erro |

### Baixa prioridade / consistência

- Textos visíveis sem acentuação padronizados (`api.ts`, `feedback.tsx`, `main.tsx`).
- Papel do usuário exibido traduzido ("Administrador") em vez do enum cru.
- Diálogo com `aria-labelledby`/`aria-describedby`, foco ao abrir, foco devolvido ao fechar e
  bloqueio de `Esc`/clique no fundo durante o envio.
- Abas com `role="tablist"`/`aria-selected`; toasts com `role="status"`/`aria-live`;
  drawer mobile fecha com `Esc` e trava o scroll do fundo; mensagens de erro de campo com `role="alert"`.
- Gráfico de rosca com `role="img"` e resumo textual.
- Erros de tela derivam mensagem de 403/404 em vez de texto genérico.
- `ConfirmDialog` não afirma mais que a remoção de vínculo é reversível.
- Chaves de lista por conteúdo (relatórios) e não por índice.

## 4. Verificações que passaram sem achado

- Autorização aplicada no backend em todas as rotas de escrita; `assertProfessionalAccess`
  cobre todos os acessos aninhados de profissional (nenhum caminho de CONSULTANT lendo ou
  escrevendo dados de terceiros).
- Ordenação restrita a colunas conhecidas (`buildOrderBy`); paginação com `@Max(200)`.
- Status de certificação sempre calculado em runtime (nunca persistido), com fuso de negócio.
- Cobertura isolada em `CoverageService`, com proteção contra divisão por zero.
- Filtro global de exceções não expõe stack trace; auditoria em todas as escritas.
- Frontend: nenhum `dangerouslySetInnerHTML`; tokens nunca em `localStorage`
  (apenas em memória); `rel="noreferrer"` em links externos; listas com chave.

## 5. Ajuste pós-QA — autoatendimento do CONSULTANT (D-019)

Depois da varredura, ficou definido que o consultor mantém os **próprios vínculos de
certificação** sem que se criem telas ou módulos novos: a permissão é contextual na
mesma página de perfil, e o escopo continua sendo aplicado no serviço
(`assertProfessionalAccess`). As três rotas aninhadas passaram a aceitar `CONSULTANT`;
cadastro, papel/status e áreas de gestão seguem exclusivos de ADMIN/MANAGER.

Verificado na suíte (bloco 5b, 11 verificações): criar, editar (com status recalculado) e
remover o próprio vínculo; `403` ao tentar vincular/editar/remover dados de terceiros; e
`403` ao tentar alterar o próprio cadastro/status ou **escalar o próprio papel** para
ADMIN. Detalhes da decisão em `docs/DECISIONS.md` (D-019).

## 5b. Módulo Tec News — ingestão e curadoria (D-020)

O Tec News foi validado na suíte (bloco 11b, 19 verificações): listagem e resumo
(contadores) para ADMIN e acesso de leitura pelo CONSULTANT; `403` do CONSULTANT ao curar
novidades, administrar fontes e disparar sincronização; curadoria manual (`201`) e link
duplicado (`409`); leitura/salvo **por usuário** (a marcação do consultor não afeta o
admin); filtro de salvas; destaque (pin) pelo MANAGER; CRUD de fonte com `400` para fonte
automática sem URL e desativação soft; remoção (soft) da novidade. A limpeza da suíte
passou a remover `news_read_states`/`news_items`/`news_sources` **antes** dos `vendors`
(a FK de `news_sources.vendor_id` é `RESTRICT`) e confirma o estado DEMO com 6 novidades e
5 fontes.

Complementarmente, a ingestão foi exercitada **manualmente** contra um feed real (Red Hat):
a sincronização criou 10 itens, marcou a fonte como `OK` e, no segundo disparo, atualizou
0/criou 0 — confirmando a deduplicação por URL. A suíte de aceite **não** executa a
ingestão ao vivo (dependeria de rede e seria não determinística); cobre apenas as rotas e o
RBAC.

## 5c. Módulo Releases — changelog (D-021)

Validado na suíte (bloco 11c, 12 verificações): listagem por ADMIN com **exatamente uma**
versão atual; `403` do CONSULTANT ao acessar e ao criar; criação com itens (`201`); versão
duplicada (`409`) e formato fora de `X.Y.Z` (`400`); troca da versão atual permanecendo
única; edição que **substitui** os itens; remoção (soft) que some da lista. A limpeza da
suíte passou a apagar `releases` e confere 11 releases no estado DEMO final.

> A constante `APP_VERSION` do frontend (`config/version.ts`) acompanha a release marcada
> como atual; é uma duplicação consciente para exibir o rodapé sem chamada extra.

## 5d. Módulo Tec News — resumo inteligente (D-022)

Validado na suíte (bloco 11d, 6 verificações): listagem ordenada por relevância
(`sort=relevanceScore`) com `relevanceScore`/`relevanceFocus` preenchidos pelo seed; o
CONSULTANT **lê** o resumo (`200`) mas **não gera** (`403`); no estado DEMO, ainda sem
resumo, o `GET` devolve `digest: null`; e, com a IA desligada, o `POST /news/digest`
responde **`503`** — confirmando a **degradação graciosa** (o módulo segue funcionando com
a relevância heurística). A limpeza passou a apagar `news_digests`. O caminho com IA foi
exercitado **manualmente** contra um endpoint compatível com OpenAI (mock): o resumo foi
persistido, os destaques refletidos nos itens e a geração auditada.

> A suíte **não** chama a IA real (dependeria de rede, chave e custo, além de ser não
> determinística); cobre as rotas, o RBAC e a degradação.

## 5e. Módulo Configurações — IA (D-023)

Validado na suíte (bloco 11e, 8 verificações): o ADMIN lê a configuração efetiva e a
resposta **não expõe** a chave (`apiKey` ausente); CONSULTANT (`GET`) e MANAGER (`PUT`)
recebem `403`; o ADMIN salva a configuração (chave **cifrada**, `apiKeySource = settings`) e
a IA passa a valer na hora (`GET /news/digest` → `aiEnabled: true`); o teste com provedor
inacessível devolve `400`; e desligar + limpar a chave desativa a IA. A limpeza da suíte
passou a apagar `app_settings`. O caminho feliz do teste de conexão foi exercitado
**manualmente** contra um mock compatível com OpenAI (`200 ok`).

> A suíte não depende de um provedor real: o teste de conexão é validado pelo caminho de
> erro (provedor inacessível) e a persistência pelo formato da resposta.

## 5f. Acesso — senha provisória (D-024)

Validado na suíte (bloco 11f, 13 verificações): ao criar um profissional com senha sem
informar `mustChangePassword`, a marca vem **ligada por padrão** e o login devolve
`mustChangePassword: true`; com a senha provisória, `/auth/me` responde `200` mas
qualquer rota de negócio (ex.: `/news`) responde **`403`**; a troca erra com senha atual
incorreta (`400`), nova senha igual à atual (`400`) e nova senha fraca (`400`); a troca
válida devolve novos tokens com a marca **limpa** e libera o acesso; a senha provisória
antiga **deixa de autenticar** e a nova funciona; uma senha **definitiva**
(`mustChangePassword: false`) acessa de imediato; e o MANAGER **não** pode marcar senha
provisória (`403`). A limpeza da suíte apaga os profissionais de QA com o restante do
estado DEMO.

> A suíte valida o fluxo completo de primeira sessão; a revogação das sessões anteriores
> (refresh tokens) é coberta indiretamente pela troca de tokens e pelo login com a senha
> antiga.

## 5g. Anexo do comprovante de certificação (D-025)

Validado na suíte (bloco 11g, 10 verificações): o vínculo nasce sem anexo
(`hasAttachment: false`); o ADMIN anexa um PDF (`200`, `hasAttachment: true`); um arquivo que
não é PDF (mesmo com `Content-Type` forjado) é recusado (`400`, validação da assinatura
`%PDF-`); o download autenticado devolve o PDF (magic bytes `%PDF-` e `Content-Type:
application/pdf`); o CONSULTANT não baixa nem remove anexo de terceiros (`403`) mas anexa no
próprio vínculo (`200`); e o ADMIN remove o anexo (`204`), voltando `hasAttachment: false`.
A limpeza da suíte passou a remover a pasta `backend/uploads` (anexos de teste).

> O caminho de **substituição** (trocar o PDF existente apagando o anterior) é exercitado
> pelo mesmo endpoint de upload e verificado indiretamente pelo estado final; o arquivo é
> servido sempre por rota autenticada, nunca por URL pública.

## 5h. Roadmap próprio do consultor + anexo (D-026)

Validado na suíte (bloco 11h, 14 verificações): o CONSULTANT **cria** um item no próprio
roadmap (`201`, `professionalId` igual ao seu, sem anexo) mas recebe **`403`** ao tentar
criar/editar o roadmap de terceiros; **edita** o próprio item (`200`) e, mesmo enviando outro
`professionalId`, o item **não muda de dono**; **muda o status** (`COMPLETED`); **anexa** um
PDF (`200`, `hasAttachment: true`) e um arquivo que não é PDF é recusado (`400`); o
**download autenticado** devolve o PDF (magic bytes `%PDF-`) e um CONSULTANT não baixa anexo
de terceiros (`403`); a gestão remove o anexo (`204`) e cria item no roadmap de qualquer
profissional (`201`); e o CONSULTANT **remove** o próprio item (`204`), que sai do roadmap.

> Roadmap e vínculo de certificação permanecem **independentes** nesta entrega (D-026): o
> roadmap é o plano/evolução (certificação, renovação, curso, treinamento, projeto, laboratório);
> o vínculo é a credencial concreta. A integração automática fica para uma decisão futura.

## 5i. Navegação do consultor (D-027)

Mudança de **frontend**, sem novos endpoints: o CONSULTANT passa a ter a área **"Meu roadmap"**
na navegação e é direcionado a ela após o login; **Fabricantes, Tecnologias e Certificações
deixam de aparecer** para ele (menu lateral e abas do perfil). A gestão mantém todas as áreas.
O backend não mudou (o roadmap já era escopado por dono e a escrita do catálogo já era
ADMIN/MANAGER); a **leitura** do catálogo segue liberada porque o formulário de roadmap usa
essas opções. Efeito colateral assumido: o autoatendimento do vínculo de certificação (D-019)
e do anexo do vínculo (D-025) ficam restritos a ADMIN/MANAGER — o consultor usa o item de
roadmap (D-026).

## 5j. Roadmap em Kanban/Timeline e painel de consultores (D-028)

Validado na suíte (bloco 9, +3 verificações): `GET /reports/consultants` responde ao
ADMIN/MANAGER com um array em que cada item traz `stats` e `items` do roadmap, e o
CONSULTANT recebe **`403`**. No frontend, a área "Meu roadmap" (e a aba Roadmap do perfil)
ganha o seletor **Lista / Kanban / Timeline** — no Kanban, arrastar o cartão muda o status
pelo endpoint do próprio profissional. Em **Relatórios**, a aba **Consultores** mostra um
card por consultor ativo (abertos, atrasados, total) e o clique abre a janela flutuante com
os itens resumidos. O endpoint devolve tudo numa chamada, sem N requisições.

## 5k. Módulo Tickets — espelho do Zoho Desk e Medições Mensais (D-029)

O módulo fica **desligado por padrão** (`TICKETS_ENABLED=false`): quando desligado, **todas**
as rotas (`/clients`, `/tickets`, `/measurements` e as de sincronização) respondem `404` e o
frontend não mostra o menu (controlado por `VITE_TICKETS_ENABLED`). A suíte **detecta** isso —
a primeira chamada a `/clients` que retorna `404` faz o bloco inteiro virar `[SKIP]`. Com o
módulo ligado, o bloco 11i (20 verificações) valida:

- **RBAC**: clientes/chamados/medições respondem `200` para ADMIN; o CONSULTANT recebe `403`.
- **Cálculo do mês (fuso e virada) + faturamento**: como o espelho é **somente leitura** (não
  há `POST /tickets`), a suíte insere quatro chamados de QA diretamente no banco e gera a
  medição de **out/2026**: entram apenas os **faturaveis** com `close_date` no mês — o chamado
  encerrado em `2026-11-01T02:00:00Z` (= 31/10 23h em `America/Sao_Paulo`) cai em **outubro**,
  o de `2026-11-01T03:00:00Z` (= 01/11 00h) cai em **novembro**, e o não-faturável é excluído →
  **2 chamados / 50 minutos**.
- **Imutabilidade**: fechar → `CLOSED`; gerar de novo (`409`) e fechar de novo (`409`) são
  bloqueados.
- **Exportação**: `export.csv` responde `text/csv` com **BOM UTF-8** e `export.pdf` começa com
  `%PDF-`; um rascunho **não** é exportável (`400`).
- **Reabertura**: `403` para MANAGER; ADMIN reabre com justificativa (volta a `DRAFT`).
- **Sincronização**: com `ZOHO_SYNC_ENABLED=true` (exige credenciais), dois disparos seguidos
  confirmam a **idempotência** (a 2ª execução cria 0); desligada, `POST /tickets/sync` responde
  **`503`** — **degradação graciosa** (clientes/medições seguem funcionando).

> A guarda de dados e a limpeza da suíte passaram a incluir as tabelas do módulo
> (`clients`/`tickets`/`monthly_measurements`/`unmapped_tickets`): a presença de qualquer
> registro **aborta** a execução (proteção de dados reais) e, ao final, tudo é removido — o
> estado DEMO volta com **0 clientes / 0 chamados**.

> O espelhamento ao vivo **não** roda na suíte (dependeria do Zoho real; seria não
> determinístico). Foi exercitado **manualmente** contra um **mock** do Zoho Desk (token OAuth
> + `GET /tickets`), cobrindo upsert idempotente por `zohoTicketId`, a fila de **não-mapeados** e
> o vínculo manual a um cliente (a fila deixa de reenfileirar um chamado já vinculado).

## 5l. Módulo Chamados — integração Zoho configurável e Relatórios de Chamados (D-030)

Sobre a base da D-029, o **bloco 11j** (25 verificações) cobre a integração Zoho configurável e
os Relatórios de Chamados. Quando o módulo está desligado (`TICKETS_ENABLED=false`), o bloco
inteiro vira `[SKIP]` (a 1ª chamada a `/contracts` retorna `404`). Com o módulo ligado:

- **Configurações (leitura/posse)**: `/settings/zoho`, `/settings/email` e `/settings/branding`
  respondem `200` ao ADMIN e **`403` ao CONSULTANT**; `/contracts` idem.
- **Contratos**: cria (`201`, com política `ACCUMULATE`); cliente inexistente → `404`; política
  inválida → `400`; desativação soft → `204`.
- **Métricas (B2) e faturamento (B3)**: a suíte insere (via banco, pois o espelho é leitura) 2
  chamados + 2 **lançamentos de tempo** e gera a prévia de out/2026 →
  **2 fechados / 90 minutos**; com franquia de **60 min**, os **30 min adicionais** levam a
  `WITH_EXTRA_HOURS` (regra B3). Os **alertas** incluem "sem tecnologia" e "sem horas".
- **Relatório do Cliente**: prévia (HTML) responde `200`; o PDF começa com `%PDF-` (A4 com
  cabeçalho/tabela repetidos e rodapé paginado) e **não** contém valores de contrato.
- **Relatório Financeiro**: a prévia traz o assunto no padrão
  (`[Liberação de Faturamento] …`); o `.eml` responde `message/rfc822` com **anexo PDF**; o
  **envio exige confirmação** — sem `confirm: true` retorna **`400`**.
- **Config Zoho (escrita)**: salvar o data center (`eu`) reflete na leitura; o **log de
  sincronização** responde `200`.
- **Identidade visual (escrita)**: salvar cores reflete na leitura.

> O **envio real** de e-mail (SMTP/Graph) e o **espelhamento ao vivo** do Zoho **não** rodam na
> suíte (dependeriam de serviços externos; seriam não determinísticos). Foram exercitados
> **manualmente** contra **mocks** (SMTP em `:2525`, Graph em HTTP e o Zoho Desk simulado),
> cobrindo `message/rfc822` com anexo, `sendMail` do Graph e o `testConnection` com erro
> detalhado. A limpeza da suíte passou a incluir `contracts`, `time_entries` e
> `generated_reports` — o estado DEMO volta com **0 contratos / 0 lançamentos / 0 relatórios**.

O **bloco 11k** (9 verificações) cobre a **fila de não mapeados** e o **vínculo em lote** (D-031).
A suíte insere (via banco) 3 linhas na `unmapped_tickets` (2 de uma conta, 1 de outra) e, com o
módulo ligado:

- **Agrupamento** (`GET /tickets/unmapped/groups`) responde `200` com um array.
- **Vínculo em lote**: sem `ids` nem `accountId` → **`400`**; por **conta** vincula as **2** linhas
  (`linked=2, created=2`); por **seleção** vincula a restante (`linked=1`).
- **Auto-limpeza**: após o vínculo por conta a fila cai de **3 → 1** linha; ao final, os **3**
  chamados existem **ligados ao cliente**.
- **Posse**: o **CONSULTANT** recebe **`403`**.

Os artefatos da 11k (chamados, linhas da fila e cliente) são removidos ao fim do próprio bloco.

O **bloco 11l** (2 verificações) cobre a **reimportação dos lançamentos de tempo** (D-032):
`POST /tickets/sync/time-entries` responde `200` com `{ tickets, entries, errors }` ao ADMIN (ou
`503` quando o Zoho não está configurado — degradação graciosa, como no `POST /tickets/sync`); o
**CONSULTANT** recebe **`403`**. A leitura real dos lançamentos (endpoint `/timeEntry`) foi
validada contra o **Zoho Desk de produção**; o parâmetro `hoursSpent`/`minutesSpent`/`secondsSpent`
vem como **texto** e é somado em minutos (`ticket #626` → 4 lançamentos = **300 min**).

## 5m. Menu lateral em submenus (D-033)

Alteração **exclusivamente de frontend** (`layouts/navigation.ts` e `layouts/sidebar.tsx`), sem
endpoint, migration ou permissão nova. O menu agrupa os itens relacionados em **submenus
retráteis**: **"Catálogo"** (Profissionais, Fabricantes, Tecnologias, Certificações) e **"GSS
Qualidade"** (Clientes, Tickets, Medições, Contratos, Relatórios de Chamados). Verificações:
`visibleNavItems` continua **filtrando por papel** e **descarta o grupo** quando nenhum filho é
visível (o CONSULTANT não vê o Catálogo); o submenu **expande sozinho** quando a rota atual
pertence ao grupo, expõe **`aria-expanded`** e mantém o estado na sessão; o **drawer mobile**
funciona igual. Validação por `typecheck` e `build` (ambos limpos) — a navegação não é coberta
pela suíte de aceite (que é de API). Nesta entrega também foi **corrigida a contagem de releases
do estado DEMO** no aceite (13 → 16), defasada em relação ao seed.

## 6. Limitações conhecidas (aceitas no MVP)

1. **Estado em memória**: o limitador de login e o cache não usam store compartilhado —
   com múltiplas réplicas é necessário Redis.
2. **Auditoria fora de transação** nas escritas comuns (só importação e renovação são
   transacionais). Falha de auditoria é registrada em log e não interrompe a operação.
3. **Sem constraint única parcial** para "certificação em vigor por profissional": a
   regra é validada na aplicação (corrida teórica em requisições simultâneas).
4. **Paginação do histórico** limitada às 100 entradas mais recentes.
5. **Relatórios carregam as tabelas em memória** para agregação — aceitável na escala do
   MVP; migrar para `groupBy`/`count` com volume maior.
6. **Bundle único** (~660 kB); code-splitting por rota é otimização futura.
7. Os scripts de teste das fases 2–7 (PowerShell, escritos durante o desenvolvimento)
   vivem fora do repositório e foram **substituídos por `scripts/acceptance.sh`**, que
   cobre os mesmos cenários mais os da Fase 8; o F3 mantém uma verificação atualizada pela
   D-019 (o CONSULTANT vincula no próprio perfil).
8. **Tec News — ingestão:** a sincronização agendada exige saída HTTPS para os fabricantes
   e vem desligada por padrão; as URLs de feed podem mudar (administráveis; o erro fica em
   `last_error`). O parser é tolerante e cobre os campos essenciais — não extrai o conteúdo
   completo da página (decisão D-020) nem segue links. A classificação de tipo e a
   relevância são heurísticas (palavras-chave + recência).
9. **Tec News — resumo inteligente:** vem desligado por padrão e exige um endpoint de IA
   compatível com OpenAI. Pode ser configurado por variáveis de ambiente (`AI_*`) ou pela
   tela de **Configurações** (D-023); a interface tem precedência. Quando ligado, gera
   tráfego de saída e tem custo por chamada (limitado pela janela e pelo teto de itens). Uma
   falha da IA responde `503` sem afetar a lista; o resumo é um snapshot (não recalcula itens
   escondidos).
10. **Configurações (D-023):** restritas a ADMIN; a chave de IA fica **cifrada** no banco,
    dependente de `SETTINGS_ENCRYPTION_KEY` (ou do segredo de acesso do JWT). Trocar o
    segredo de cifra invalida a chave salva (é preciso salvá-la de novo). Não há cache
    distribuído: cada réplica lê a configuração do banco.
11. **Releases:** "apenas uma versão atual" é garantido na aplicação (transação), sem
    constraint única parcial; e a versão exibida no rodapé (`APP_VERSION`) é mantida à mão,
    precisando acompanhar a release atual marcada no banco.

## 7. Achados encaminhados para fases futuras (fora do MVP)

- Auditoria de eventos de autenticação (login/logout/refresh).
- "Logout de todos os dispositivos" na interface.
- Expurgo periódico de refresh tokens expirados.
- Integrações (Zoho) e notificações de novidades (e-mail/Teams/Slack/WhatsApp).
- Treinamentos/cursos do consultor: entidade nova (schema + migration), reaproveitando o
  padrão de rota aninhada + aba no perfil definido na D-019.
- Tec News: extração do conteúdo completo da página (scraping); classificação por IA mais
  rica que a heurística (a via de resumo já existe na D-022); fontes adicionais
  (segurança/CVE por fabricante) e notificação das novidades.
- Releases: gerar o rascunho da release a partir dos commits/tags do git (hoje é cadastro
  manual) e derivar `APP_VERSION` da release atual em vez de constante.
