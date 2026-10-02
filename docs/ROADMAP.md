# Roadmap de Implementação — Suporte Skills

Desenvolvimento incremental por fases. **Nenhuma fase avança sem validação** da
anterior. Ao fim de cada fase: testar, corrigir, revisar arquitetura, atualizar
documentação e apresentar o bloco *FASE X — CONCLUÍDA*.

| Fase | Nome | Escopo | Status |
|------|------|--------|--------|
| 0 | Arquitetura | Produto, stack, estrutura, banco, APIs, telas, decisões | ✅ Concluída |
| 1 | Fundação | Projeto, Docker, PostgreSQL, Prisma, migrations, auth, layout, sidebar, tema, seed | ✅ Concluída |
| 2 | Cadastros | CRUD de profissionais, fabricantes, tecnologias, certificações | ✅ Concluída |
| 3 | Relacionamentos | Profissional↔Certificação, certificação↔fabricante/tecnologia, validade, status dinâmico | ✅ Concluída |
| 4 | Roadmap | Lista, criação/edição, filtros, Kanban (drag-and-drop), Timeline, atrasados | ✅ Concluída |
| 5 | Dashboard | KPIs, gráficos, vencimentos, roadmap, alertas, cobertura tecnológica (API real) | ✅ Concluída |
| 6 | Relatórios | Certificações, vencimentos, roadmap, por fabricante, exportação CSV | ✅ Concluída |
| 7 | Importação | CSV, validação, preview, confirmação, relatório de erros | ✅ Concluída |
| 8 | QA | Testes funcionais/API/permissões/regras, formulários, responsividade, segurança, UX | ✅ Concluída |
| 9 | Tec News | Novidades dos fabricantes: fontes RSS/Atom, ingestão agendada, curadoria manual, filtros, destaques, leitura/salvo por usuário | ✅ Concluída (pós-MVP) |
| 10 | Releases | Changelog do sistema: versões com itens por categoria, versão atual, gestão pela administração | ✅ Concluída (pós-MVP) |

## Critérios de aceite da Fase 8

1. Cadastros (criar/editar/desativar) de profissionais, fabricantes, tecnologias e
   certificações validados por API.
2. Vínculo profissional↔certificação com status dinâmico (ACTIVE/EXPIRING/EXPIRED/
   NO_EXPIRATION) e histórico preservado na renovação.
3. Roadmap: criação, edição, Kanban por situação, filtro de atrasados combinável com
   intervalo de datas, timeline e itens atrasados.
4. Dashboard: KPIs, distribuição de status, próximos vencimentos, cobertura tecnológica
   e alertas calculados no backend.
5. Relatórios: certificações, vencimentos, roadmap e fabricantes, com exportação CSV
   (UTF-8 BOM + separador `;`) e proteção contra CSV injection.
6. Importação CSV: prévia, validação por linha, commit apenas das linhas válidas e
   relatório de erros; nada é gravado sem confirmação.
7. Autenticação: login, `/auth/me`, refresh com rotação, detecção de reuso e logout.
8. Permissões: matriz ADMIN/MANAGER/CONSULTANT verificada em todas as áreas.
9. Segurança: headers HTTP, CORS restrito, limite de tentativas de login, validação de
   entrada, datas estritas, segredos exigidos e erros sem vazamento de detalhes internos.
10. Seed DEMO restaurado ao final dos testes; migration versionada; documentação
    atualizada (`docs/QA.md`) e builds/typechecks limpos.

> **Ajuste pós-QA (D-019):** o CONSULTANT passou a manter os **próprios vínculos de
> certificação** (criar, editar, renovar, remover) pela mesma página de perfil — permissão
> contextual aplicada no backend, sem telas, módulos ou rotas novos. Cadastro, papel/status
> e áreas de gestão seguem exclusivos de ADMIN/MANAGER. Suíte na ocasião: 92 verificações, 0 falhas.

> **Módulo pós-MVP (D-020) — Tec News:** novidades dos canais oficiais dos fabricantes
> (Red Hat, Nutanix, Veeam, ExaGrid, SUSE), com ingestão automática de RSS/Atom (opt-in) e
> curadoria manual, leitura/salvo por usuário e destaques. Migration `20261001000000_tec_news`.

> **Módulo pós-MVP (D-021) — Releases:** changelog do próprio sistema, gerenciável por
> ADMIN/MANAGER, com versão atual destacada e itens por categoria. Migration
> `20261001120000_releases`.

> **Módulo pós-MVP (D-022) — Tec News: resumo inteligente:** destaca para o consultor o que
> importa (funcionalidades de produto e certificações técnicas). Relevância determinística
> sempre ativa + resumo por IA (endpoint compatível com OpenAI, opt-in), automático na
> sincronização e sob demanda. Migration `20261001150000_news_digest`.

> **Módulo pós-MVP (D-023) — Configurações (IA):** parâmetros de IA editáveis pela interface
> (ADMIN), com teste de conexão; chave cifrada em repouso e nunca devolvida. Resolução
> banco-sobrepõe-ambiente (env segue como default). Migration `20261001180000_app_settings`.

> **Acesso (D-024) — Senha provisória:** o ADMIN cria o acesso do consultor com uma senha
> provisória; no primeiro login o sistema exige a troca (tela `/trocar-senha`), bloqueando
> as demais rotas até a nova senha. Migration `20261002120000_must_change_password`.

> **Certificações (D-025) — Anexo do comprovante:** o consultor anexa o PDF do certificado
> no próprio vínculo; o arquivo fica em `./data/uploads` (fora do web root) e é servido só
> por rota autenticada. Migration `20261002150000_certification_attachment`. Versão `0.6.0`.
> Suíte ampliada com os blocos 11f (senha provisória) e 11g (anexo).

> **Roadmap (D-026) — Autoatendimento do consultor + anexo no item:** o consultor mantém o
> próprio roadmap (certificação, renovação, curso, treinamento, projeto, laboratório) na aba
> do perfil e anexa o PDF do comprovante a cada item; rotas aninhadas com escopo por dono. O
> board global segue da gestão; catálogo e cadastro de profissionais seguem com ADMIN/MANAGER.
> Migration `20261002180000_roadmap_attachment`. Versão `0.7.0`. Suíte ampliada com o bloco 11h.

> **Navegação do consultor (D-027) — foco no roadmap:** o consultor passa a ter a área
> "Meu roadmap" na navegação (e entra nela após o login); Fabricantes, Tecnologias e
> Certificações deixam de aparecer para ele (menu e abas do perfil), ficando com a gestão.
> Sem mudança de API/migration. Versão `0.7.1`.

## Critérios de aceite da Fase 1 (histórico)

1. `docker compose up` sobe `web` + `api` + `db` do zero.
2. `.env.example` completo; configuração via env.
3. Migration inicial versionada e aplicada.
4. Seed DEMO idempotente com dados variados (ativas, expirando, vencidas, sem
   validade, roadmaps em andamento e atrasados).
5. Login funcional; rota protegida rejeita não autenticado; `/auth/me`.
6. Layout com sidebar (8 itens), tema claro (dark opcional), identidade azul.
7. Páginas placeholder com estados de loading/empty/error.
8. Responsividade desktop/tablet/mobile.
9. Lint/typecheck/build passando em frontend e backend.
10. `docs/` criado e coerente com o código.

## Futuro (fora do MVP)

Skills (níveis 0–5), Treinamentos, Projetos, Parcerias e requisitos, Gap Analysis,
Capacity Planning, IA (sugestões/gaps/relatórios), integração Zoho (CRM/Desk/
Analytics) e scraping/monitoramento avançado de fabricantes (a via RSS/Atom do Tec News
já cobre o cenário inicial).

Para evoluções identificadas na QA (auditoria de autenticação, logout de todos os
dispositivos, expurgo de refresh tokens, paginação do histórico), ver `docs/QA.md`.
