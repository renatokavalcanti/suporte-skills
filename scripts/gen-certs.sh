#!/usr/bin/env bash
# ===========================================================================
# Gera um certificado TLS autoassinado para o nginx (HTTPS) do Suporte Skills.
#
# Uso:
#   bash scripts/gen-certs.sh [IP] [DNS_EXTRA...]
#
# Exemplo:
#   bash scripts/gen-certs.sh 10.0.0.200 vmrenato
#
# Saida: certs/fullchain.pem e certs/privkey.pem (montados no container web).
# ===========================================================================
set -euo pipefail

IP="${1:-127.0.0.1}"
shift || true

SAN="IP:$IP,IP:127.0.0.1,DNS:localhost"
for d in "$@"; do SAN="$SAN,DNS:$d"; done

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT_DIR/certs"
mkdir -p "$OUT_DIR"

openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
  -keyout "$OUT_DIR/privkey.pem" \
  -out "$OUT_DIR/fullchain.pem" \
  -subj "/CN=$IP" \
  -addext "subjectAltName=$SAN"

chmod 600 "$OUT_DIR/privkey.pem"
chmod 644 "$OUT_DIR/fullchain.pem"

echo "Certificado gerado em $OUT_DIR (SAN: $SAN)"
echo "Suba/recrie o web: docker compose up -d --build web"
