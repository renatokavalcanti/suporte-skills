#!/usr/bin/env bash
# ===========================================================================
# Deploy do Suporte Skills na VM (padrao: por GIT).
#
# Executar NO servidor (dentro do repositorio). Faz, em ordem:
#   1) git fetch/checkout do ref desejado (default: main);
#   2) backup do banco (dump via container) - pule com --skip-backup;
#   3) build das imagens (api + web) - pule com --no-build;
#   4) docker compose up -d;
#   5) aguarda a API ficar saudavel (GET /api/v1/health = 200);
#   6) tenta criar a release do changelog do APP_VERSION atual
#      (se existir scripts/releases/<versao>.json) - best-effort.
#
# Uso:
#   bash scripts/deploy.sh                 # deploya main
#   bash scripts/deploy.sh v0.9.0          # deploya uma tag especifica
#   bash scripts/deploy.sh main --no-build --skip-backup
#
# NUNCA roda seed nem a suite destrutiva (acceptance.sh) em dados reais.
# ===========================================================================
set -euo pipefail

REF="main"
SKIP_BACKUP=0
NO_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --skip-backup) SKIP_BACKUP=1 ;;
    --no-build) NO_BUILD=1 ;;
    -*) echo "Opcao desconhecida: $arg" && exit 2 ;;
    *) REF="$arg" ;;
  esac
done

cd "$(dirname "$0")/.."
echo "== repositorio: $(pwd)"

# --- 1) Codigo (git) -------------------------------------------------------
git fetch --tags --prune origin
git checkout -f "$REF"
if git symbolic-ref -q HEAD >/dev/null; then
  git pull --ff-only origin "$(git rev-parse --abbrev-ref HEAD)" || true
fi
echo "== HEAD: $(git rev-parse --short HEAD) ($(git describe --tags --always 2>/dev/null || echo -))"

# --- Variaveis do .env -----------------------------------------------------
set -a; . ./.env; set +a

# --- 2) Backup do banco (via container) ------------------------------------
if [ "$SKIP_BACKUP" != '1' ]; then
  mkdir -p backups
  TS=$(date +%Y%m%d-%H%M%S)
  echo "== backup do banco..."
  docker compose exec -T db pg_dump -U "${POSTGRES_USER:-suporte}" -d "${POSTGRES_DB:-suporte_skills}" \
    > "backups/suporte_skills_${TS}.sql"
  echo "== backup: backups/suporte_skills_${TS}.sql ($(wc -c < "backups/suporte_skills_${TS}.sql") bytes)"
fi

# --- 3) Build + 4) up ------------------------------------------------------
if [ "$NO_BUILD" != '1' ]; then
  echo "== build (api + web)..."
  docker compose build api web
fi
echo "== up -d..."
docker compose up -d

# --- 5) Health -------------------------------------------------------------
echo -n "== aguardando a API ficar saudavel"
CODE=000
for _ in $(seq 1 60); do
  CODE=$(curl -sk -o /dev/null -w '%{http_code}' https://localhost/api/v1/health 2>/dev/null || echo 000)
  [ "$CODE" = '200' ] && { echo ' ok'; break; }
  echo -n '.'; sleep 2
done
if [ "$CODE" != '200' ]; then
  echo; echo "[ERRO] health nao respondeu 200"; docker compose logs --tail=40 api; exit 1
fi

# --- 6) Release do changelog (best-effort) ---------------------------------
VERSION=$(sed -n "s/.*APP_VERSION = '\([0-9][0-9.]*\)'.*/\1/p" frontend/src/config/version.ts)
RJ="scripts/releases/${VERSION}.json"
if [ -n "$VERSION" ] && [ -f "$RJ" ]; then
  TOKEN=$(curl -sk -X POST https://localhost/api/v1/auth/login -H 'Content-Type: application/json' \
    -d "{\"email\":\"${SEED_ADMIN_EMAIL}\",\"password\":\"${SEED_ADMIN_PASSWORD}\"}" \
    | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
  if [ -n "$TOKEN" ]; then
    if curl -sk "https://localhost/api/v1/releases?current=true" -H "Authorization: Bearer $TOKEN" | grep -q "\"$VERSION\""; then
      echo "== release $VERSION ja estava atual"
    else
      C=$(curl -sk -o /dev/null -w '%{http_code}' -X POST https://localhost/api/v1/releases \
        -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d @"$RJ")
      echo "== release $VERSION criada no changelog (http=$C)"
    fi
  else
    echo "== [aviso] nao loguei para criar a release $VERSION (confira SEED_ADMIN_* no .env)"
  fi
fi

docker compose ps
echo "== deploy concluido: $(git rev-parse --short HEAD)"
