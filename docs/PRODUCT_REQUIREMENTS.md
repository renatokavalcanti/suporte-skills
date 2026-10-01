# Suporte Skills — Requisitos do Produto

**Technical Capability Management** · Suporte Informática Soluções Ltda.

## 1. Visão

Plataforma interna que transforma dados de pessoas, tecnologias, certificações e
objetivos em uma **visão de capacidade técnica da equipe**. Deve responder rápido:

- Quem conhece / é certificado em determinada tecnologia?
- Quantas certificações temos? Quais vencem? Quais venceram?
- Quais tecnologias têm pouca cobertura?
- Quem está em treinamento e quais são os próximos objetivos?
- Temos capacidade para sustentar o portfólio atual e os próximos negócios?

## 2. Conceito central

```
Profissional → Competências → Tecnologias → Certificações → Experiência
            → Roadmap → Gaps → Capacidade da equipe
```

## 3. Escopo do MVP

| # | Módulo | Fase |
|---|--------|------|
| 1 | Dashboard | 5 |
| 2 | Profissionais | 2 / 3 |
| 3 | Fabricantes | 2 |
| 4 | Tecnologias | 2 |
| 5 | Certificações | 2 / 3 |
| 6 | Roadmap (Lista, Kanban, Timeline) | 4 |
| 7 | Relatórios (+ CSV) | 6 |
| 8 | Autenticação e autorização | 1 |
| 9 | Importação CSV | 7 |
| 10 | Alertas básicos | 5 |
| 11 | Tec News (novidades dos fabricantes) | pós-MVP |
| 12 | Releases (changelog do sistema) | pós-MVP |

Fora do MVP (arquitetura preparada, **não implementar**): Skills com níveis,
Treinamentos, Projetos, Parcerias e requisitos, Gap Analysis, Capacity Planning,
IA, integração Zoho e scraping/monitoramento avançado de fabricantes (a via RSS/Atom
é coberta pelo Tec News).

### 3.1 Tec News (módulo pós-MVP, D-020)

Área que reúne **novidades das tecnologias estudadas** (releases, novas certificações,
funcionalidades, avisos de segurança), combinando:

1. **Ingestão automática** de feeds RSS/Atom oficiais dos fabricantes (escopo inicial:
   Red Hat, Nutanix, Veeam, ExaGrid, SUSE), deduplicada pela URL e classificada por tipo.
   É **opt-in** (`NEWS_SYNC_ENABLED`), com disparo manual e agendamento configurável.
2. **Curadoria manual** (ADMIN/MANAGER) para canais sem feed ou destaques.

Requisitos: filtros por fabricante, tecnologia, tipo e período; busca; marcação de
**lida/salva por usuário**; destaque (pin); vínculo com o `Vendor`/`Technology` existentes;
escrita restrita a ADMIN/MANAGER e leitura liberada a todos os papéis.

### 3.2 Releases (módulo pós-MVP, D-021)

Área que **documenta o que mudou em cada versão do sistema**. Cada release tem versão
(`X.Y.Z`), título, resumo, data e itens categorizados (Novidade, Melhoria, Correção,
Segurança, Infraestrutura, Outro). Exatamente uma é a **versão atual**, exibida no rodapé
da navegação. Gerenciável por ADMIN/MANAGER (criar, editar, tornar atual, remover); o seed
traz o histórico real do projeto.

## 4. Regras de negócio essenciais

1. **Status de certificação é derivado, nunca armazenado.**
   - `EXPIRED`: `expires_at < hoje`
   - `EXPIRING`: `hoje ≤ expires_at ≤ hoje + N` (N configurável, padrão 90)
   - `ACTIVE`: `expires_at > hoje + N`
   - `NO_EXPIRATION`: `expires_at` ausente
   Calculado no backend (`CertificationStatusService`); o frontend só exibe.
2. **Nenhum número fixo no dashboard.** Tudo vem do backend/banco.
3. **Regra de negócio no backend**; frontend apenas consome a API.
4. **Cobertura tecnológica** encapsulada em serviço substituível
   (`profissionais com certificação ativa na tecnologia ÷ profissionais ativos`).
5. **Renovação gera histórico** (nova linha), preservando recertificações.

## 5. Papéis

| Papel | Permissões |
|-------|-----------|
| **ADMIN** | Acesso completo. |
| **MANAGER** | Administra profissionais, fabricantes, tecnologias, certificações, roadmap e relatórios. |
| **CONSULTANT** | Vê apenas o próprio perfil (resumo, certificações, tecnologias, roadmap e histórico) e **mantém os próprios vínculos de certificação** (criar, editar, renovar, remover — D-019). Não vê dados de terceiros nem áreas de gestão. Nunca altera o próprio cadastro, papel ou status. |

A autorização é aplicada no **backend** (guards) com escopo por dono
(`assertProfessionalAccess`), não apenas escondendo botões. Ao entrar, o CONSULTANT é
levado direto ao próprio perfil.

## 6. Identidade visual

SaaS moderno, limpo, desktop-first, responsivo. Light mode padrão, dark opcional.
Azul = primária; verde = positivo; amarelo = atenção; vermelho = problema;
azul/cinza = neutro.

## 7. Critérios de aceite do MVP

Os 25 critérios do prompt mestre (criar/editar/desativar profissional; criar
fabricante; tecnologia vinculada; criar certificação; vincular a profissional;
status automático; vencimentos; roadmap com status e Kanban; atrasados;
dashboard real; relatórios; CSV; importações; autenticação; permissões; Docker;
migrations; seed; documentação).

**Situação:** todos atendidos e verificados na Fase 8 — evidências, achados e
limitações em [`QA.md`](./QA.md) (suíte de aceite com 123 verificações e 0 falhas, já
incluindo os blocos dos módulos **Tec News** e **Releases**).
