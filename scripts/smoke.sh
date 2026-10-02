#!/usr/bin/env bash
# ===========================================================================
# Suporte Skills - teste de fumaca (NAO destrutivo)
#
# Valida que a aplicacao esta no ar e funcional SEM alterar dados: saude da
# API/web, login dos tres papeis e leitura de algumas rotas (incluindo as
# recentes de Tec News/Releases/Configuracoes). Nao executa seed, nao apaga
# nem grava nada - e o teste indicado para rodar depois de um deploy em ambiente
# com dados reais (a suite de aceite, com RESET_DEMO=1, apaga tudo e reaplica
# o seed DEMO).
#
# Uso:
#   bash scripts/smoke.sh                     # contra http://127.0.0.1:4000
#   API_URL=https://10.0.0.200/api/v1 WEB_URL=https://10.0.0.200 \
#   CURL_CA_BUNDLE=/caminho/fullchain.pem bash scripts/smoke.sh
#
# Variaveis (opcionais):
#   API_URL, WEB_URL, NODE_BIN, CURL_BIN
#   SMOKE_ADMIN_EMAIL/PASSWORD (padrao: conta DEMO)
#   SMOKE_MANAGER_EMAIL/PASSWORD e SMOKE_CONSULTANT_EMAIL/PASSWORD: OPCIONAIS.
#     Sem esses valores, as verificacoes de manager/consultor sao puladas (em
#     ambiente real so o ADMIN existe). Informe-os para exercitar o RBAC.
#   SMOKE_INSECURE=1  -> adiciona -k ao curl (certificado autoassinado)
# ===========================================================================
set -u

API="${API_URL:-http://127.0.0.1:4000/api/v1}"
WEB="${WEB_URL:-http://127.0.0.1:5173}"
NODE_BIN="${NODE_BIN:-node}"
CURL_BIN="${CURL_BIN:-curl}"
CURL_TLS=""
[ "${SMOKE_INSECURE:-0}" = '1' ] && CURL_TLS='-k'

ADMIN_EMAIL="${SMOKE_ADMIN_EMAIL:-admin@suporte.local}"
ADMIN_PASSWORD="${SMOKE_ADMIN_PASSWORD:-Admin@123}"
MANAGER_EMAIL="${SMOKE_MANAGER_EMAIL:-}"
MANAGER_PASSWORD="${SMOKE_MANAGER_PASSWORD:-}"
CONSULTANT_EMAIL="${SMOKE_CONSULTANT_EMAIL:-}"
CONSULTANT_PASSWORD="${SMOKE_CONSULTANT_PASSWORD:-}"

WORK_DIR="${WORK_DIR:-${TMPDIR:-/tmp}/suporte-skills-smoke}"
if command -v cygpath >/dev/null 2>&1; then
  WORK_DIR="$(cygpath -m "$WORK_DIR")"
fi
mkdir -p "$WORK_DIR" || exit 1
QUERY="$WORK_DIR/query.js"
OUT="$WORK_DIR/body.json"
PASS=0
FAIL=0
CODE=""

cat > "$QUERY" <<'JS'
const chunks = [];
process.stdin.on('data', (c) => chunks.push(c));
process.stdin.on('end', () => {
  let parsed;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    return console.log('__NOT_JSON__');
  }
  try {
    const result = Function('o', 'return (' + process.argv[2] + ')')(parsed);
    if (result === undefined) return console.log('__UNDEF__');
    if (result === null) return console.log('null');
    console.log(typeof result === 'object' ? JSON.stringify(result) : String(result));
  } catch (error) {
    console.log('__EXPR_ERROR__');
  }
});
JS

check() {
  if [ "$1" = "0" ]; then PASS=$((PASS + 1)); echo "[PASS] $2 :: $3"
  else FAIL=$((FAIL + 1)); echo "[FAIL] $2 :: $3"; fi
}

q() { "$NODE_BIN" "$QUERY" "$1" < "$OUT"; }

call() { # call METHOD PATH TOKEN [JSON]
  local method="$1" path="$2" token="${3:-}" data="${4:-}"
  local args=(-s $CURL_TLS -o "$OUT" -w "%{http_code}" -X "$method" "$API$path")
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  [ -n "$data" ] && args+=(-H "Content-Type: application/json" -d "$data")
  CODE=$("$CURL_BIN" "${args[@]}")
}

login() { # login EMAIL PASSWORD -> token
  "$CURL_BIN" -s $CURL_TLS -o "$OUT" -X POST "$API/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" >/dev/null
  q "o.accessToken"
}

echo "=================================================================="
echo " Suporte Skills | teste de fumaca ($(date '+%d/%m/%Y %H:%M'))"
echo " API: $API"
echo " (nao destrutivo: nenhum dado e criado/alterado/removido)"
echo "=================================================================="

CODE=$("$CURL_BIN" -s $CURL_TLS -o /dev/null -w "%{http_code}" "$WEB/")
check "$([ "$CODE" = '200' ]; echo $?)" 'frontend responde' "http=$CODE"

call GET /health "" ""
check "$([ "$CODE" = '200' ] && [ "$(q 'o.status')" = 'ok' ]; echo $?)" \
  'API saudavel' "http=$CODE status=$(q 'o.status') db=$(q 'o.database')"

ADMIN=$(login "$ADMIN_EMAIL" "$ADMIN_PASSWORD")
check "$([ -n "$ADMIN" ]; echo $?)" 'login do ADMIN' "len=${#ADMIN}"

MANAGER=""
CONSULTANT=""
if [ -n "$MANAGER_EMAIL" ]; then
  MANAGER=$(login "$MANAGER_EMAIL" "$MANAGER_PASSWORD")
  check "$([ -n "$MANAGER" ]; echo $?)" 'login do MANAGER' "len=${#MANAGER}"
else
  echo "[SKIP] MANAGER nao informado (SMOKE_MANAGER_EMAIL)"
fi
if [ -n "$CONSULTANT_EMAIL" ]; then
  CONSULTANT=$(login "$CONSULTANT_EMAIL" "$CONSULTANT_PASSWORD")
  check "$([ -n "$CONSULTANT" ]; echo $?)" 'login do CONSULTANT' "len=${#CONSULTANT}"
else
  echo "[SKIP] CONSULTANT nao informado (SMOKE_CONSULTANT_EMAIL)"
fi

call GET /auth/me "$ADMIN"
check "$([ "$CODE" = '200' ] && [ "$(q 'typeof o.id')" = 'string' ]; echo $?)" \
  'sessao do ADMIN (/auth/me)' "http=$CODE"

call GET /dashboard "$ADMIN"
check "$([ "$CODE" = '200' ] && [ "$(q 'typeof o.cards.professionals')" = 'number' ]; echo $?)" \
  'dashboard responde' "http=$CODE profissionais=$(q 'o.cards.professionals')"

call GET /news "$ADMIN"
check "$([ "$CODE" = '200' ] && [ "$(q 'typeof o.meta.total')" = 'number' ]; echo $?)" \
  'Tec News lista novidades' "http=$CODE total=$(q 'o.meta.total')"

call GET /news/digest "$ADMIN"
check "$([ "$CODE" = '200' ] && [ "$(q 'typeof o.aiEnabled')" = 'boolean' ]; echo $?)" \
  'resumo do Tec News (leitura)' "http=$CODE aiEnabled=$(q 'o.aiEnabled')"

call GET /releases "$ADMIN"
check "$([ "$CODE" = '200' ]; echo $?)" 'releases (ADMIN)' "http=$CODE"

call GET /settings/ai "$ADMIN"
check "$([ "$CODE" = '200' ] && [ "$(q 'typeof o.apiKey')" = 'undefined' ]; echo $?)" \
  'configuracoes de IA sem expor a chave' "http=$CODE apiKey=$(q 'typeof o.apiKey')"

if [ -n "$CONSULTANT" ]; then
  call GET /settings/ai "$CONSULTANT"
  check "$([ "$CODE" = '403' ]; echo $?)" 'CONSULTANT nao acessa configuracoes' "http=$CODE"
fi

call GET '/professionals/x/certifications/y/attachment' ''
check "$([ "$CODE" = '401' ]; echo $?)" 'anexo exige autenticacao (D-025)' "http=$CODE"

rm -f "$OUT" "$QUERY"
echo "=================================================================="
echo "RESUMO (smoke): $PASS PASS / $FAIL FAIL"
echo "=================================================================="
[ "$FAIL" = '0' ]
