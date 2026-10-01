#!/usr/bin/env bash
# ===========================================================================
# Suporte Skills - backup do banco (NAO destrutivo)
#
# Gera um dump SQL do banco da aplicacao em backups/. Somente leitura: nao
# altera nem apaga nada. Use antes de rodar seed/suite de aceite em qualquer
# ambiente, ou periodicamente como rotina.
#
# Uso:
#   bash scripts/backup-db.sh
#   DB_NAME=suporte_skills PGPASSWORD=segredo bash scripts/backup-db.sh
#
# Variaveis (opcionais):
#   DB_USER (padrao suporte), DB_HOST (localhost), DB_PORT (5432),
#   DB_NAME (suporte_skills), PGPASSWORD
#   PG_DUMP_BIN (padrao pg_dump) — se ausente, tenta `docker compose exec db`
#   BACKUP_DIR (padrao <repo>/backups)
#   KEEP_BACKUPS (padrao 10) — quantos dumps manter (0 desativa a limpeza)
#
# Restaurar (exemplo):
#   psql -U suporte -h localhost -d suporte_skills < backups/arquivo.sql
#   # ou, com o Postgres no container:
#   docker compose exec -T db psql -U suporte -d suporte_skills < backups/arquivo.sql
# ===========================================================================
set -u

DB_USER="${DB_USER:-suporte}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-suporte_skills}"
PG_DUMP_BIN="${PG_DUMP_BIN:-pg_dump}"
KEEP_BACKUPS="${KEEP_BACKUPS:-10}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$REPO_DIR/backups}"
if command -v cygpath >/dev/null 2>&1; then
  BACKUP_DIR="$(cygpath -u "$BACKUP_DIR" 2>/dev/null || printf '%s' "$BACKUP_DIR")"
fi

mkdir -p "$BACKUP_DIR" || { echo "[ERRO] Nao foi possivel criar $BACKUP_DIR"; exit 1; }
STAMP="$(date '+%Y%m%d-%H%M%S')"
OUT="$BACKUP_DIR/${DB_NAME}_${STAMP}.sql"

echo "Backup de '$DB_NAME' -> $OUT"

run_host_dump() {
  PGPASSWORD="${PGPASSWORD:-}" "$PG_DUMP_BIN" \
    -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" \
    --no-owner --no-privileges --clean --if-exists > "$OUT"
}

run_docker_dump() {
  ( cd "$REPO_DIR" && docker compose exec -T db pg_dump \
      -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges --clean --if-exists ) > "$OUT"
}

if command -v "$PG_DUMP_BIN" >/dev/null 2>&1; then
  if ! run_host_dump 2>/tmp/backup-err.$$; then
    echo "[ERRO] pg_dump falhou: $(cat /tmp/backup-err.$$ 2>/dev/null)"
    rm -f "/tmp/backup-err.$$" "$OUT"
    exit 1
  fi
  rm -f "/tmp/backup-err.$$"
elif command -v docker >/dev/null 2>&1 && [ -f "$REPO_DIR/docker-compose.yml" ]; then
  echo "(pg_dump local ausente; usando o container 'db' via docker compose)"
  if ! run_docker_dump; then
    echo "[ERRO] backup via docker compose falhou"
    rm -f "$OUT"
    exit 1
  fi
else
  echo "[ERRO] pg_dump nao encontrado e docker compose indisponivel."
  exit 1
fi

SIZE="$(wc -c < "$OUT" | tr -d '[:space:]')"
if [ "${SIZE:-0}" -lt 100 ]; then
  echo "[ERRO] dump suspeito (${SIZE} bytes)"
  exit 1
fi
echo "OK: $(basename "$OUT") (${SIZE} bytes)"

if [ "$KEEP_BACKUPS" -gt 0 ]; then
  # Mantem apenas os KEEP_BACKUPS mais recentes do proprio banco.
  ls -1t "$BACKUP_DIR/${DB_NAME}_"*.sql 2>/dev/null | tail -n "+$((KEEP_BACKUPS + 1))" | while read -r old; do
    rm -f "$old" && echo "removido backup antigo: $(basename "$old")"
  done
fi
