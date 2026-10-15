# Publicação na nuvem (Azure) — D-037

Ambiente de **nuvem** do Suporte Skills numa VM na Azure, com **HTTPS real
(Let's Encrypt)** via **Caddy**, sem alterar o ambiente on-prem.

## Arquitetura

```text
Internet ──443/80──► [ Caddy ]  (termina o TLS, Let's Encrypt)
                         │  proxy HTTP (rede interna do compose)
                         ▼
                     [ web:80 ]  (nginx: SPA + /api → api:4000)
                         │
                         ▼
                     [ api:4000 ] ──► [ db:5432 ]   (postgres)
```

- **Caddy** (`docker-compose.cloud.yml`): emite e **renova** o certificado do
  `DOMAIN` automaticamente (desafio HTTP-01 na porta 80) e faz o proxy para o
  serviço `web`.
- **web**: no ambiente de nuvem serve **apenas HTTP** (`frontend/nginx.cloud.conf`),
  pois o TLS fica no Caddy. No on-prem continua usando `frontend/nginx.conf` (HTTPS
  com certificado autoassinado).
- **db/api/web** não publicam porta no host (só a rede interna do compose). O
  Postgres e a API **não** ficam expostos à internet.

## Pré-requisitos

1. VM Linux (Ubuntu) com **Docker Engine + plugin compose** instalados.
2. **NSG** da Azure liberando **80**, **443** (e **22** para administração).
   Portas 4000/5432 **não** devem ser abertas.
3. **DNS**: registro **A** `DOMAIN → <IP público da VM>`. O certificado só é
   emitido quando o domínio resolve para a VM **e** a porta 80 está acessível.
4. IP público **estático** (recomendado) para o A record não mudar.

## Deploy (na VM)

```bash
# 1) Clonar/atualizar o repositorio
git clone https://github.com/renatokavalcanti/suporte-skills.git
cd suporte-skills

# 2) Criar o .env a partir do exemplo de nuvem e preencher
cp .env.cloud.example .env
#    -> DOMAIN, ACME_EMAIL, PUBLIC_*_URL, POSTGRES_PASSWORD e os segredos
#       (gere: openssl rand -base64 48)
#    -> APP_ENVIRONMENT=PRD (exibe o selo do ambiente na interface, D-038)
$EDITOR .env

# 3) Subir o stack (base + override de nuvem)
docker compose -f docker-compose.yml -f docker-compose.cloud.yml up -d --build

# 4) Primeira carga (ambiente novo): seed DEMO (opcional)
docker compose -f docker-compose.yml -f docker-compose.cloud.yml \
  --profile tools run --rm seed
```

O `docker-compose.yml` lê `VITE_TICKETS_ENABLED` em tempo de build da SPA — no
`.env` deixe `VITE_TICKETS_ENABLED=true` para o módulo Tickets aparecer.

## Validar

```bash
# Certificado emitido (o Caddy leva ~30s no primeiro acesso)
curl -sI https://SEU-DOMINIO/ | head -1

# Smoke nao-destrutivo (ajuste as credenciais do admin)
API_URL=https://SEU-DOMINIO/api/v1 WEB_URL=https://SEU-DOMINIO \
  SMOKE_INSECURE=0 NODE_BIN=node CURL_BIN=curl \
  SMOKE_ADMIN_EMAIL="admin@suporte.local" SMOKE_ADMIN_PASSWORD="Admin@123" \
  bash scripts/smoke.sh
```

## Operação

- **Logs:** `docker compose -f docker-compose.yml -f docker-compose.cloud.yml logs -f caddy`
  (e `... logs -f api`). O Caddy grava em `caddy_data` (`/data/access.log`).
- **Atualizar:** `git pull` e repita o `up -d --build`.
- **Backup do banco:** dump dentro do container (`docker compose exec -T db pg_dump ...`);
  ver `scripts/backup-db.sh` (no on-prem falha por causa de auth; na nuvem use o exec).
- **Renovação do TLS:** automática pelo Caddy (nada a fazer).

## Diferenças do on-prem (checklist)

| Item | On-prem | Nuvem (Azure) |
|------|---------|---------------|
| TLS | Certificado **autoassinado** (`scripts/gen-certs.sh`) | **Let's Encrypt** via Caddy |
| Acesso | Rede interna (10.0.0.200) | **Internet** (domínio público) |
| Portas expostas | 443/8080 na LAN | 80/443 públicos (NSG); 4000/5432 internos |
| SSH | Chave | **Chave** (troque o login por senha) e NSG 22 restrito |
| Dados | Reais | Novos (DEMO) ou importados do dump |

## Segurança (recomendado após subir)

- Trocar o **login SSH por senha** por **chave** e **desabilitar** `PasswordAuthentication`.
- Restringir a **porta 22** no NSG ao seu IP.
- Ativar `ufw` (80/443 liberados) e `unattended-upgrades`.
- Fixar o **IP público** como **estático**.
