# QA — Fase 8

Revisão de qualidade do MVP concluída em **30/09/2026**, cobrindo os 25 critérios de
aceite do prompt mestre. Método: inspeção de código (backend e frontend), revisão de
segurança, e uma suíte de regressão automatizada de ponta a ponta.

## 1. Escopo e método

| Frente | Como foi verificado |
|--------|---------------------|
| API e regras de negócio | Suíte `scripts/acceptance.sh` — **137 verificações**, 100% aprovadas |
| Permissões (RBAC) | Matriz ADMIN/MANAGER/CONSULTANT em dashboard, cadastros, roadmap, relatórios, importação e dados de terceiros |
| Segurança | Headers (Helmet), CORS, força bruta no login, reuso de refresh token, injeção em CSV, validação de entrada, exposição de erro |
| Regras de negócio | Status dinâmico, cobertura, vencimentos, auditoria, renovação, duplicidade |
| Frontend | Inspeção de estados (loading/vazio/erro), formulários, responsividade, acessibilidade, controle de acesso por papel, sessão |
| Infra | Migration versionada, seed idempotente, `docker-compose`, documentação |

## 2. Suíte de regressão

A suíte vive no repositório: **`scripts/acceptance.sh`** (137 verificações). Ela exige a
API e o frontend no ar e o **seed DEMO aplicado**; ao final limpa os dados de teste e
reaplica o seed (`RESET_DEMO=0` desativa essa restauração).

```bash
npm run seed --prefix backend      # garante o estado DEMO
bash scripts/acceptance.sh         # 137 PASS / 0 FAIL
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
ou remover dados**: frontend, `/health`, login dos três papéis, `/auth/me`, dashboard, Tec
News (lista + resumo) e configurações de IA (sem expor a chave; `403` para o CONSULTANT).
É o teste indicado **após um deploy** em ambiente com dados reais. Aceita `API_URL`,
`WEB_URL`, `NODE_BIN`, `CURL_BIN`, `SMOKE_*_EMAIL/PASSWORD` e `SMOKE_INSECURE=1` (curl `-k`).

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
| 9. Relatórios e CSV | 8 |
| 10. Importação CSV | 9 |
| 11. Frontend e proxy | 2 |
| 11b. Tec News (D-020) | 19 |
| 11c. Releases (D-021) | 12 |
| 11d. Tec News — resumo inteligente (D-022) | 6 |
| 11e. Configurações de IA (D-023) | 8 |
| 12. Limpeza e restauração do seed | 1 |
| **Total** | **137** |

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
suíte passou a apagar `releases` e confere 6 releases no estado DEMO final.

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
