#!/usr/bin/env bash
# ===========================================================================
# Suite de aceite do Suporte Skills (Fase 8 + Tec News + Releases + Resumo IA + Config) — 137 verificacoes
#
# Uso:
#   bash scripts/acceptance.sh
#
# Requisitos:
#   - API e frontend no ar, banco com o seed DEMO aplicado (npm run seed);
#   - curl e um runtime Node disponiveis; psql para as verificacoes de banco.
#
# Variaveis (todas opcionais):
#   API_URL    base da API            (padrao http://127.0.0.1:4000/api/v1)
#   WEB_URL    base do frontend       (padrao http://127.0.0.1:5173)
#   NODE_BIN   runtime Node           (padrao node)
#   CURL_BIN   cliente HTTP           (padrao curl)
#   PSQL_BIN   cliente PostgreSQL     (padrao psql)
#   NPM_BIN    gerenciador npm        (padrao npm, usado ao restaurar o seed)
#   BACKEND_DIR diretorio do backend  (padrao backend, relativo a raiz do repo)
#   WORK_DIR   diretorio temporario   (padrao /tmp/suporte-skills-acceptance)
#   DB_USER/DB_HOST/DB_PORT/DB_NAME   (padrao suporte/localhost/5432/suporte_skills)
#   RESET_DEMO 1|0 — ao final, limpa o banco e reaplica o seed (padrao 1)
#   ALLOW_DATA_LOSS 1 — autoriza a limpeza mesmo com dados que nao sao do seed
#   SKIP_BACKUP 1 — nao gera o dump de seguranca antes da limpeza (padrao 0)
#
# A suite cria e remove dados proprios (prefixo QA) e, com RESET_DEMO=1,
# deixa o banco exatamente no estado DEMO documentado.
#
# ATENCAO: com RESET_DEMO=1 a limpeza final APAGA TODOS os dados e reaplica o
# seed DEMO. Para proteger dados reais, a suite ABORTA se encontrar registros
# que nao pertencem ao seed, a menos que ALLOW_DATA_LOSS=1. Em ambiente com
# dados de verdade, use RESET_DEMO=0 (ou prefira scripts/smoke.sh, sem escrita).
# ===========================================================================
set -u

API="${API_URL:-http://127.0.0.1:4000/api/v1}"
WEB="${WEB_URL:-http://127.0.0.1:5173}"
NODE_BIN="${NODE_BIN:-node}"
CURL_BIN="${CURL_BIN:-curl}"
PSQL_BIN="${PSQL_BIN:-psql}"
NPM_BIN="${NPM_BIN:-npm}"
BACKEND_DIR="${BACKEND_DIR:-backend}"
WORK_DIR="${WORK_DIR:-${TMPDIR:-/tmp}/suporte-skills-acceptance}"
DB_USER="${DB_USER:-suporte}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-suporte_skills}"
RESET_DEMO="${RESET_DEMO:-1}"

# Em Git Bash / MSYS os binarios nativos (node, curl, psql) precisam de caminho
# no formato Windows; cygpath -m devolve "C:/..." (valido para ambos).
if command -v cygpath >/dev/null 2>&1; then
  WORK_DIR="$(cygpath -m "$WORK_DIR")"
fi

mkdir -p "$WORK_DIR" || exit 1
QUERY="$WORK_DIR/query.js"
OUT="$WORK_DIR/body.json"
COOKIES="$WORK_DIR/cookies.txt"
PASS=0
FAIL=0

# --- helpers ---------------------------------------------------------------
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

printf 'name,email,position,professional_type,seniority\nZzz Importe Um,importe.um@suporte.local,Analista,CLT,JUNIOR\nInvalido Email,email-invalido,Analista,CLT,SENIOR\nDuplicado,importe.um@suporte.local,Analista,CLT,JUNIOR\nJa Existe,admin@suporte.local,Analista,CLT,JUNIOR\nTipo Ruim,importe.cinco@suporte.local,Analista,XYZ,JUNIOR\n' > "$WORK_DIR/imp-prof.csv"
printf 'professional_email,vendor,certification,obtained_at,expires_at,certificate_number\nlucas.almeida@suporte.local,Red Hat,Red Hat Certified Engineer (RHCE),01/01/2026,01/01/2029,IMP-1\nnao.existe@suporte.local,Red Hat,Red Hat Certified Engineer (RHCE),2026-01-01,2029-01-01,IMP-2\nlucas.almeida@suporte.local,Fabricante X,Qualquer,2026-01-01,2029-01-01,IMP-3\ncarlos.souza@suporte.local,Nutanix,Nutanix Certified Professional - Multicloud Infrastructure,2024-01-01,2027-01-01,IMP-4\nlucas.almeida@suporte.local,Red Hat,Red Hat Certified System Administrator (RHCSA),2027-01-01,2026-01-01,IMP-5\n' > "$WORK_DIR/imp-cert.csv"
printf '' > "$WORK_DIR/imp-empty.csv"

check() {
  if [ "$1" = "0" ]; then PASS=$((PASS + 1)); echo "[PASS] $2 :: $3"
  else FAIL=$((FAIL + 1)); echo "[FAIL] $2 :: $3"; fi
}

CODE=""
call() { # call METHOD PATH TOKEN [JSON]
  local method="$1" path="$2" token="${3:-}" data="${4:-}"
  local args=(-s -o "$OUT" -w "%{http_code}" -X "$method" "$API$path")
  if [ -n "$token" ]; then args+=(-H "Authorization: Bearer $token"); fi
  if [ -n "$data" ]; then args+=(-H "Content-Type: application/json" -d "$data"); fi
  CODE=$("$CURL_BIN" "${args[@]}")
}

q() { "$NODE_BIN" "$QUERY" "$1" < "$OUT"; }
days() { "$NODE_BIN" -e "console.log(new Date(Date.now()+($1)*86400000).toISOString().slice(0,10))"; }
count() { "$PSQL_BIN" -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -tAc "$1" | tr -d '[:space:]'; }
TS=$("$NODE_BIN" -e "console.log(Date.now())")

login() { # login EMAIL PASSWORD -> token
  CODE=$("$CURL_BIN" -s -c "$COOKIES" -o "$OUT" -w "%{http_code}" -X POST "$API/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}")
  q "o.accessToken"
}

echo "=================================================================="
echo " Suporte Skills | suite de aceite ($(date '+%d/%m/%Y %H:%M'))"
echo " API: $API"
if [ "$RESET_DEMO" = '1' ]; then
  echo " AVISO: ao final, os dados serao apagados e o seed DEMO reaplicado."
fi
echo "=================================================================="

# ---------------------------------------------------------------------------
# Guarda de dados: a limpeza final (RESET_DEMO=1) apaga TUDO e reaplica o seed.
# Se houver registros fora do seed DEMO, aborta antes de qualquer teste, para
# nao destruir dados reais por engano (ALLOW_DATA_LOSS=1 forca a execucao).
if [ "$RESET_DEMO" = '1' ] && [ "${ALLOW_DATA_LOSS:-0}" != '1' ]; then
  NON_DEMO="$("$PSQL_BIN" -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -tAc "
    SELECT
      (SELECT count(*) FROM professionals WHERE id NOT LIKE 'prof-%') +
      (SELECT count(*) FROM vendors WHERE id NOT LIKE 'ven-%') +
      (SELECT count(*) FROM technologies WHERE id NOT LIKE 'tec-%') +
      (SELECT count(*) FROM certifications WHERE id NOT LIKE 'cer-%') +
      (SELECT count(*) FROM professional_certifications WHERE id NOT LIKE 'pc-%') +
      (SELECT count(*) FROM roadmap_items WHERE id NOT LIKE 'rm-%')
  " 2>/dev/null | tr -d '[:space:]')"
  if [ -n "$NON_DEMO" ] && [ "$NON_DEMO" != '0' ]; then
    echo
    echo "[ABORT] Encontrei $NON_DEMO registro(s) que nao pertencem ao seed DEMO."
    echo "        A limpeza final (RESET_DEMO=1) apagaria TODOS os dados e restauraria o DEMO."
    echo "        Rodar sem apagar nada:   RESET_DEMO=0 bash scripts/acceptance.sh"
    echo "        Apagar mesmo assim:      ALLOW_DATA_LOSS=1 bash scripts/acceptance.sh"
    echo
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
echo "--- 1. Autenticacao (criterio 21) ---"
ADMIN=$(login 'admin@suporte.local' 'Admin@123')
MANAGER=$(login 'maria.oliveira@suporte.local' 'Suporte@123')
CONSULTANT=$(login 'carlos.souza@suporte.local' 'Suporte@123')
[ -n "$ADMIN" ] && [ -n "$MANAGER" ] && [ -n "$CONSULTANT" ]
check $? 'login dos 3 papeis' "admin/manager/consultant len=${#ADMIN}"

call POST /auth/login '' '{"email":"admin@suporte.local","password":"errada"}'
check "$([ "$CODE" = '401' ]; echo $?)" 'senha errada -> 401' "http=$CODE"

call GET /auth/me ''
check "$([ "$CODE" = '401' ]; echo $?)" 'rota protegida sem token -> 401' "http=$CODE"

call GET /auth/me "$ADMIN"
check "$([ "$CODE" = '200' ] && [ "$(q 'o.email')" = 'admin@suporte.local' ]; echo $?)" '/auth/me devolve o usuario' "http=$CODE email=$(q 'o.email')"

OLD_REFRESH=$(grep -i 'ss_refresh' "$COOKIES" | awk '{print $NF}')
CODE=$("$CURL_BIN" -s -c "$COOKIES" -b "$COOKIES" -o "$OUT" -w "%{http_code}" -X POST "$API/auth/refresh" -H "Content-Type: application/json" -d '{}')
NEW_TOKEN=$(q "o.accessToken")
check "$([ "$CODE" = '200' ] && [ -n "$NEW_TOKEN" ]; echo $?)" 'refresh renova a sessao' "http=$CODE"

CODE=$("$CURL_BIN" -s -o "$OUT" -w "%{http_code}" -X POST "$API/auth/refresh" -H "Content-Type: application/json" \
  -H "Cookie: ss_refresh=$OLD_REFRESH" -d '{}')
check "$([ "$CODE" = '401' ]; echo $?)" 'reuso de refresh token -> 401' "http=$CODE"

CODE=$("$CURL_BIN" -s -b "$COOKIES" -c "$COOKIES" -o "$OUT" -w "%{http_code}" -X POST "$API/auth/logout" -H "Content-Type: application/json" -d '{}')
check "$([ "$CODE" = '200' ]; echo $?)" 'logout -> 200' "http=$CODE"

ADMIN=$(login 'admin@suporte.local' 'Admin@123')
MANAGER=$(login 'maria.oliveira@suporte.local' 'Suporte@123')
CONSULTANT=$(login 'carlos.souza@suporte.local' 'Suporte@123')

# ---------------------------------------------------------------------------
echo "--- 2. Seguranca (headers, CORS, forca bruta) ---"
HEADERS=$("$CURL_BIN" -s -D - -o /dev/null "$API/health")
echo "$HEADERS" | grep -qi "x-content-type-options: nosniff"
check $? 'header X-Content-Type-Options' "nosniff"
echo "$HEADERS" | grep -qi "x-frame-options"
check $? 'header X-Frame-Options (clickjacking)' ""
echo "$HEADERS" | grep -qi "x-powered-by"
check "$([ $? -ne 0 ]; echo $?)" 'nao expoe X-Powered-By' ""

CORS=$("$CURL_BIN" -s -D - -o /dev/null -X OPTIONS "$API/professionals" \
  -H "Origin: http://evil.example" -H "Access-Control-Request-Method: GET")
echo "$CORS" | grep -qi "access-control-allow-origin: http://evil.example"
check "$([ $? -ne 0 ]; echo $?)" 'CORS nao reflete origem desconhecida' "(apenas origens configuradas)"

BLOCKED=""
for _ in $(seq 1 11); do
  CODE=$("$CURL_BIN" -s -o /dev/null -w "%{http_code}" -X POST "$API/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"bruteforce@suporte.local","password":"tentativa-errada"}')
  [ "$CODE" = '429' ] && BLOCKED="yes"
done
check "$([ "$BLOCKED" = 'yes' ]; echo $?)" 'forca bruta bloqueada -> 429' "11 tentativas falhas no mesmo e-mail"

CODE=$("$CURL_BIN" -s -o /dev/null -w "%{http_code}" -X POST "$API/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@suporte.local","password":"Admin@123"}')
check "$([ "$CODE" = '200' ]; echo $?)" 'bloqueio nao afeta outros usuarios' "http=$CODE"

# ---------------------------------------------------------------------------
echo "--- 3. Permissoes (criterio 22) ---"
for spec in "dashboard:/dashboard" "profissionais:/professionals" "kanban:/roadmap/kanban" "relatorios:/reports/certifications"; do
  name="${spec%%:*}"; path="${spec##*:}"
  call GET "$path" "$ADMIN"; a=$CODE
  call GET "$path" "$MANAGER"; m=$CODE
  call GET "$path" "$CONSULTANT"; c=$CODE
  check "$([ "$a" = '200' ] && [ "$m" = '200' ] && [ "$c" = '403' ]; echo $?)" \
    "RBAC $name (ADMIN/MANAGER 200, CONSULTANT 403)" "a=$a m=$m c=$c"
done

call POST /professionals "$CONSULTANT" '{"name":"Nao Permitido","email":"nao.permitido@suporte.local"}'
check "$([ "$CODE" = '403' ]; echo $?)" 'CONSULTANT nao cria profissional' "http=$CODE"
call POST /vendors "$CONSULTANT" '{"name":"Vendor Proibido"}'
check "$([ "$CODE" = '403' ]; echo $?)" 'CONSULTANT nao cria fabricante' "http=$CODE"
call DELETE /professionals/prof-joao-silva "$CONSULTANT"
check "$([ "$CODE" = '403' ]; echo $?)" 'CONSULTANT nao desativa terceiros' "http=$CODE"

call GET /professionals/prof-carlos-souza/certifications "$CONSULTANT"
check "$([ "$CODE" = '200' ]; echo $?)" 'CONSULTANT ve os proprios dados' "http=$CODE"
call GET /professionals/prof-joao-silva/certifications "$CONSULTANT"
check "$([ "$CODE" = '403' ]; echo $?)" 'CONSULTANT nao ve dados de terceiros' "http=$CODE"
call GET /professionals/prof-joao-silva "$CONSULTANT"
check "$([ "$CODE" = '403' ]; echo $?)" 'CONSULTANT nao abre perfil de terceiros' "http=$CODE"

# ---------------------------------------------------------------------------
echo "--- 4. Estado do seed / banco (criterios 23, 24) ---"
TOTAL="$([ "$(count 'SELECT count(*) FROM professionals')" = '6' ] && [ "$(count 'SELECT count(*) FROM vendors')" = '8' ] && [ "$(count 'SELECT count(*) FROM technologies')" = '19' ] && [ "$(count 'SELECT count(*) FROM certifications')" = '13' ] && [ "$(count 'SELECT count(*) FROM professional_certifications')" = '11' ] && [ "$(count 'SELECT count(*) FROM roadmap_items')" = '8' ]; echo $?)"
check "$TOTAL" 'seed DEMO com os volumes documentados' "6 prof / 8 fab / 19 tec / 13 cert / 11 vinculos / 8 roadmap"

[ -f "$BACKEND_DIR/prisma/migrations/20260930000000_init/migration.sql" ]
check $? 'migration inicial versionada' "20260930000000_init"
[ -f "docker-compose.yml" ]
DOCKER_OK=$?
SERVICES=$(grep -c "^  [a-z]*:" "docker-compose.yml")
check "$([ "$DOCKER_OK" = 0 ] && [ "$SERVICES" -ge 3 ]; echo $?)" 'docker-compose com web/api/db' "servicos=$SERVICES"
DOCS_OK=0
for doc in API ARCHITECTURE DATABASE DECISIONS PRODUCT_REQUIREMENTS ROADMAP QA; do
  [ -f "docs/$doc.md" ] || DOCS_OK=1
done
check "$DOCS_OK" 'documentacao completa em /docs' "7 arquivos"

# ---------------------------------------------------------------------------
echo "--- 5. Dashboard (criterios 11, 15) ---"
call GET /dashboard "$ADMIN"
check "$([ "$CODE" = '200' ] && [ "$(q 'o.cards.professionals')" = '6' ] && [ "$(q 'o.cards.certificationsAssigned')" = '11' ]; echo $?)" \
  'cards com numeros reais' "prof=$(q 'o.cards.professionals') certs=$(q 'o.cards.certificationsAssigned')"
check "$([ "$(q 'o.cards.expiring')" = '3' ] && [ "$(q 'o.cards.expired')" = '1' ]; echo $?)" \
  'vencendo/vencidas calculados no backend' "expiring=$(q 'o.cards.expiring') expired=$(q 'o.cards.expired')"
check "$([ "$(q 'o.coverage.length')" = '19' ]; echo $?)" 'cobertura por tecnologia' "tecnologias=$(q 'o.coverage.length')"
check "$([ "$(q "o.coverage.filter(c=>c.coverage===0).length")" -ge 1 ]; echo $?)" 'tecnologias sem cobertura identificadas' "sem cobertura=$(q "o.coverage.filter(c=>c.coverage===0).length")"
check "$([ "$(q 'o.alerts.length')" -ge 3 ]; echo $?)" 'alertas gerados' "alertas=$(q 'o.alerts.length')"
check "$([ "$(q "o.upcomingExpirations.every(u=>u.status==='EXPIRING')")" = 'true' ]; echo $?)" \
  'proximos vencimentos = apenas EXPIRING' "itens=$(q 'o.upcomingExpirations.length')"
check "$([ "$(q "o.upcomingExpirations.every(u=>u.daysRemaining<=o.expiringThresholdDays)")" = 'true' ]; echo $?)" \
  'vencimentos dentro da janela configurada' "janela=$(q 'o.expiringThresholdDays') dias"

# ---------------------------------------------------------------------------
echo "--- 5b. Autoatendimento do CONSULTANT (D-019) ---"
call GET "/professionals/prof-carlos-souza/certifications" "$CONSULTANT"
OWN_IDS=$(q "o.map(r=>r.certificationId).join(',')")
OWN_BEFORE=$(q 'o.length')
check "$([ "$CODE" = '200' ]; echo $?)" 'CONSULTANT le as proprias certificacoes' "http=$CODE itens=$OWN_BEFORE"

call GET "/certifications?pageSize=100" "$CONSULTANT"
FREE_CERT=$(q "o.data.filter(c=>!'$OWN_IDS'.split(',').includes(c.id)).map(c=>c.id)[0]")
check "$([ -n "$FREE_CERT" ] && [ "$FREE_CERT" != '__UNDEF__' ]; echo $?)" 'CONSULTANT le o catalogo para vincular' "certificacao livre=$(echo "$FREE_CERT" | cut -c1-12)"

call POST "/professionals/prof-carlos-souza/certifications" "$CONSULTANT" \
  "{\"certificationId\":\"$FREE_CERT\",\"obtainedAt\":\"$(days -10)\",\"expiresAt\":\"$(days 200)\",\"certificateNumber\":\"SELF-1\"}"
SELF_REC=$(q 'o.id')
check "$([ "$CODE" = '201' ] && [ -n "$SELF_REC" ]; echo $?)" 'CONSULTANT vincula certificacao em si mesmo -> 201' "http=$CODE"

call PUT "/professionals/prof-carlos-souza/certifications/$SELF_REC" "$CONSULTANT" "{\"expiresAt\":\"$(days 20)\",\"certificateNumber\":\"SELF-1B\"}"
check "$([ "$CODE" = '200' ] && [ "$(q 'o.status')" = 'EXPIRING' ]; echo $?)" 'CONSULTANT edita o proprio registro (status recalculado)' "http=$CODE status=$(q 'o.status')"

call GET "/professionals/prof-joao-silva/certifications" "$ADMIN"
OTHER_REC=$(q 'o[0].id')
call POST "/professionals/prof-joao-silva/certifications" "$CONSULTANT" "{\"certificationId\":\"$FREE_CERT\"}"
check "$([ "$CODE" = '403' ]; echo $?)" 'CONSULTANT nao vincula em terceiros -> 403' "http=$CODE"
call PUT "/professionals/prof-joao-silva/certifications/$OTHER_REC" "$CONSULTANT" '{"notes":"invasao"}'
check "$([ "$CODE" = '403' ]; echo $?)" 'CONSULTANT nao edita registro de terceiros -> 403' "http=$CODE"
call DELETE "/professionals/prof-joao-silva/certifications/$OTHER_REC" "$CONSULTANT"
check "$([ "$CODE" = '403' ]; echo $?)" 'CONSULTANT nao remove registro de terceiros -> 403' "http=$CODE"

call PATCH "/professionals/prof-carlos-souza/status" "$CONSULTANT" '{"active":false}'
check "$([ "$CODE" = '403' ]; echo $?)" 'CONSULTANT nao altera o proprio cadastro/status -> 403' "http=$CODE"
call PUT "/professionals/prof-carlos-souza" "$CONSULTANT" '{"role":"ADMIN"}'
check "$([ "$CODE" = '403' ]; echo $?)" 'CONSULTANT nao escala o proprio papel -> 403' "http=$CODE"
call DELETE "/professionals/prof-carlos-souza/certifications/$SELF_REC" "$CONSULTANT"
check "$([ "$CODE" = '204' ]; echo $?)" 'CONSULTANT remove o proprio vinculo -> 204' "http=$CODE"
call GET "/professionals/prof-carlos-souza/certifications" "$ADMIN"
check "$([ "$(q 'o.length')" = "$OWN_BEFORE" ]; echo $?)" 'estado do consultor restaurado apos o autoatendimento' "vinculos=$(q 'o.length') antes=$OWN_BEFORE"

# ---------------------------------------------------------------------------
echo "--- 6. Cadastros (criterios 1-6) ---"
call POST /vendors "$ADMIN" "{\"name\":\"QA Fabricante $TS\",\"website\":\"https://qa.example.com\",\"partnershipStatus\":\"ACTIVE\"}"
QA_VENDOR=$(q 'o.id')
check "$([ "$CODE" = '201' ] && [ -n "$QA_VENDOR" ]; echo $?)" 'criar fabricante -> 201' "http=$CODE"

call POST /technologies "$ADMIN" "{\"vendorId\":\"$QA_VENDOR\",\"name\":\"QA Tecnologia $TS\",\"category\":\"VIRTUALIZATION\"}"
QA_TECH=$(q 'o.id')
check "$([ "$CODE" = '201' ]; echo $?)" 'criar tecnologia vinculada ao fabricante' "http=$CODE"

call POST /certifications "$ADMIN" "{\"vendorId\":\"$QA_VENDOR\",\"technologyId\":\"$QA_TECH\",\"name\":\"QA Certificacao $TS\",\"level\":\"ASSOCIATE\",\"validityMonths\":12}"
QA_CERT=$(q 'o.id')
check "$([ "$CODE" = '201' ]; echo $?)" 'criar certificacao' "http=$CODE"

call POST /professionals "$ADMIN" "{\"name\":\"QA Profissional $TS\",\"email\":\"qa.prof.$TS@suporte.local\",\"position\":\"Analista QA\",\"professionalType\":\"CLT\",\"seniority\":\"MID\"}"
QA_PROF=$(q 'o.id')
check "$([ "$CODE" = '201' ] && [ -n "$QA_PROF" ]; echo $?)" 'criar profissional -> 201' "http=$CODE"

call POST /professionals "$ADMIN" "{\"name\":\"Duplicado\",\"email\":\"qa.prof.$TS@suporte.local\"}"
check "$([ "$CODE" = '409' ]; echo $?)" 'e-mail duplicado -> 409' "http=$CODE"

call POST /professionals "$ADMIN" '{"name":"Sem Email"}'
check "$([ "$CODE" = '400' ]; echo $?)" 'payload invalido -> 400' "http=$CODE"

call PUT "/professionals/$QA_PROF" "$ADMIN" '{"seniority":"SENIOR","position":"Especialista QA"}'
check "$([ "$CODE" = '200' ] && [ "$(q 'o.seniority')" = 'SENIOR' ]; echo $?)" 'editar profissional' "http=$CODE seniority=$(q 'o.seniority')"

call PATCH "/professionals/$QA_PROF/status" "$ADMIN" '{"active":false}'
call GET "/professionals/$QA_PROF" "$ADMIN"
check "$([ "$(q 'o.active')" = 'false' ]; echo $?)" 'desativar via status (soft)' "active=$(q 'o.active')"
call PATCH "/professionals/$QA_PROF/status" "$ADMIN" '{"active":true}'

# ---------------------------------------------------------------------------
echo "--- 7. Relacionamentos e historico (criterios 7-10) ---"
call POST "/professionals/$QA_PROF/certifications" "$ADMIN" \
  "{\"certificationId\":\"$QA_CERT\",\"obtainedAt\":\"$(days -30)\",\"expiresAt\":\"$(days 300)\",\"certificateNumber\":\"QA-1\"}"
REC1=$(q 'o.id')
check "$([ "$CODE" = '201' ] && [ "$(q 'o.status')" = 'ACTIVE' ]; echo $?)" 'vincular certificacao -> status ACTIVE' "http=$CODE status=$(q 'o.status')"

call PUT "/professionals/$QA_PROF/certifications/$REC1" "$ADMIN" "{\"expiresAt\":\"$(days 20)\"}"
check "$([ "$CODE" = '200' ] && [ "$(q 'o.status')" = 'EXPIRING' ] && [ "$(q 'o.daysRemaining')" -le 90 ]; echo $?)" \
  'status dinamico recalcula EXPIRING' "status=$(q 'o.status') dias=$(q 'o.daysRemaining')"

call POST "/professionals/$QA_PROF/certifications" "$ADMIN" "{\"certificationId\":\"$QA_CERT\",\"obtainedAt\":\"$(days -1)\",\"expiresAt\":\"$(days 400)\"}"
check "$([ "$CODE" = '409' ]; echo $?)" 'duplicidade em vigor -> 409' "http=$CODE"

call POST "/professionals/$QA_PROF/certifications" "$ADMIN" \
  "{\"certificationId\":\"$QA_CERT\",\"obtainedAt\":\"$(days -5)\",\"expiresAt\":\"$(days 360)\",\"renew\":true,\"certificateNumber\":\"QA-RENOV\"}"
REC2=$(q 'o.id')
check "$([ "$CODE" = '201' ] && [ -n "$REC2" ]; echo $?)" 'renovacao cria nova linha' "http=$CODE"

call GET "/professionals/$QA_PROF/certifications" "$ADMIN"
PREV_EXPIRES=$(q "o.filter(r=>r.id==='$REC1')[0].expiresAt")
PREV_EXPIRES="${PREV_EXPIRES:0:10}"
HAS_TWO=$(q 'o.length')
check "$([ "$HAS_TWO" = '2' ] && [ "$PREV_EXPIRES" = "$(days -6)" ]; echo $?)" \
  'historico preservado: anterior encerrada na vespera' "linhas=$HAS_TWO anterior_expira=$PREV_EXPIRES esperado=$(days -6)"

call POST "/professionals/$QA_PROF/certifications" "$ADMIN" "{\"certificationId\":\"$QA_CERT\",\"renew\":true,\"obtainedAt\":\"$(days -10)\"}"
check "$([ "$CODE" = '400' ]; echo $?)" 'renovar com data anterior a atual -> 400' "http=$CODE"

call PUT "/professionals/$QA_PROF/certifications/$REC2" "$ADMIN" "{\"obtainedAt\":\"$(days -100)\",\"expiresAt\":\"$(days -60)\"}"
check "$([ "$CODE" = '200' ] && [ "$(q 'o.status')" = 'EXPIRED' ]; echo $?)" 'status dinamico recalcula EXPIRED' "status=$(q 'o.status')"

call POST "/professionals/$QA_PROF/certifications" "$ADMIN" "{\"certificationId\":\"$QA_CERT\",\"obtainedAt\":\"$(days -1)\",\"expiresAt\":\"$(days 200)\"}"
check "$([ "$CODE" = '201' ]; echo $?)" 'novo registro apos vencimento (sem renovacao explicita)' "http=$CODE"

call POST "/professionals/$QA_PROF/certifications" "$ADMIN" '{"certificationId":"cer-inexistente"}'
check "$([ "$CODE" = '400' ]; echo $?)" 'certificacao inexistente -> 400' "http=$CODE"

call POST "/professionals/$QA_PROF/certifications" "$ADMIN" "{\"certificationId\":\"$QA_CERT\",\"obtainedAt\":\"2026-02-30\"}"
check "$([ "$CODE" = '400' ]; echo $?)" 'data de calendario invalida -> 400' "2026-02-30"

call GET "/professionals/$QA_PROF/history" "$ADMIN"
check "$([ "$CODE" = '200' ] && [ "$(q 'o.length')" -ge 3 ]; echo $?)" 'historico de auditoria do profissional' "entradas=$(q 'o.length')"

# ---------------------------------------------------------------------------
echo "--- 8. Roadmap (criterios 12-14) ---"
call POST /roadmap "$ADMIN" \
  "{\"professionalId\":\"$QA_PROF\",\"certificationId\":\"$QA_CERT\",\"technologyId\":\"$QA_TECH\",\"title\":\"QA Item $TS\",\"type\":\"CERTIFICATION\",\"priority\":\"HIGH\",\"status\":\"IN_PROGRESS\",\"startDate\":\"$(days -10)\",\"dueDate\":\"$(days -3)\"}"
QA_ITEM=$(q 'o.id')
check "$([ "$CODE" = '201' ] && [ -n "$QA_ITEM" ]; echo $?)" 'criar item de roadmap' "http=$CODE"

call PUT "/roadmap/$QA_ITEM" "$ADMIN" "{\"technologyId\":\"$QA_TECH\"}"
CERT_KEPT=$(q 'o.certificationId')
check "$([ "$CODE" = '200' ] && [ "$CERT_KEPT" = "$QA_CERT" ]; echo $?)" \
  'atualizar tecnologia preserva certificacao vinculada' "certificationId=$(echo "$CERT_KEPT" | cut -c1-14)"

call PATCH "/roadmap/$QA_ITEM/status" "$ADMIN" '{"status":"COMPLETED"}'
call GET "/roadmap/$QA_ITEM" "$ADMIN"
COMPLETED_AT=$(q 'o.completedAt')
call PATCH "/roadmap/$QA_ITEM/status" "$ADMIN" '{"status":"COMPLETED"}'
call GET "/roadmap/$QA_ITEM" "$ADMIN"
COMPLETED_AT2=$(q 'o.completedAt')
check "$([ "$COMPLETED_AT" = "$COMPLETED_AT2" ] && [ -n "$COMPLETED_AT" ]; echo $?)" \
  'concluir duas vezes preserva a data de conclusao' "completedAt estavel"

call PATCH "/roadmap/$QA_ITEM/status" "$ADMIN" '{"status":"IN_PROGRESS"}'
call GET "/roadmap/kanban" "$ADMIN"
check "$([ "$CODE" = '200' ] && [ "$(q 'Object.keys(o).length')" = '5' ]; echo $?)" 'kanban com colunas por situacao' "colunas=$(q 'Object.keys(o).length')"
call GET "/roadmap?overdue=true" "$ADMIN"
OVERDUE_COUNT=$(q 'o.data.length')
check "$([ "$CODE" = '200' ] && [ "$OVERDUE_COUNT" -ge 2 ]; echo $?)" 'filtro de atrasados' "itens=$(q 'o.data.length')"
call GET "/roadmap?overdue=true&from=$(days -1)&to=$(days 1)" "$ADMIN"
STRICT_COUNT=$(q 'o.data.length')
check "$([ "$CODE" = '200' ] && [ "$STRICT_COUNT" -lt "$OVERDUE_COUNT" ]; echo $?)" \
  'atrasados combinam com intervalo de datas (nao sobrescrevem)' "com intervalo=$(q 'o.data.length') sem intervalo=$OVERDUE_COUNT"
call GET "/roadmap/timeline" "$ADMIN"
check "$([ "$CODE" = '200' ]; echo $?)" 'timeline' "http=$CODE"
call GET "/professionals/$QA_PROF/roadmap" "$ADMIN"
check "$([ "$CODE" = '200' ] && [ "$(q 'o.length')" -ge 1 ]; echo $?)" 'roadmap por profissional' "itens=$(q 'o.length')"

# ---------------------------------------------------------------------------
echo "--- 9. Relatorios e CSV (criterios 16-18) ---"
for report in certifications expirations roadmap vendors; do
  call GET "/reports/$report" "$ADMIN"
  OK="$([ "$CODE" = '200' ] && [ "$(q 'o.rows.length')" -ge 1 ] && [ "$(q 'o.columns.length')" -ge 2 ]; echo $?)"
  check "$OK" "relatorio $report" "http=$CODE linhas=$(q 'o.rows.length') colunas=$(q 'o.columns.length')"
done

"$CURL_BIN" -s -D "$WORK_DIR/csv-headers.txt" -H "Authorization: Bearer $ADMIN" "$API/reports/certifications?format=csv" -o "$WORK_DIR/report.csv"
grep -qi "text/csv" "$WORK_DIR/csv-headers.txt"
check $? 'exportacao CSV com content-type correto' "$(grep -i 'content-type' "$WORK_DIR/csv-headers.txt" | tr -d '\r')"

BOM=$("$NODE_BIN" -e "const b=require('fs').readFileSync('$WORK_DIR/report.csv');console.log(b[0]===0xEF&&b[1]===0xBB&&b[2]===0xBF?'sim':'nao')")
SEP=$("$NODE_BIN" -e "const t=require('fs').readFileSync('$WORK_DIR/report.csv','utf8');console.log(t.split(String.fromCharCode(13,10))[0].includes(';')?'sim':'nao')")
check "$([ "$BOM" = 'sim' ] && [ "$SEP" = 'sim' ]; echo $?)" 'CSV com BOM UTF-8 e separador ;' "bom=$BOM sep=$SEP"

CSV_HEADER=$("$NODE_BIN" -e "
const t=require('fs').readFileSync('$WORK_DIR/report.csv','utf8').replace(/^\uFEFF/,'');
console.log(t.split(String.fromCharCode(13,10))[0]);
")
SEP_COUNT=$(echo "$CSV_HEADER" | tr -cd ';' | wc -c)
check "$([ "$SEP_COUNT" -ge 2 ]; echo $?)" 'cabecalho CSV com rotulos e separador ;' "$(echo "$CSV_HEADER" | cut -c1-46) (sep=$SEP_COUNT)"

call POST /vendors "$ADMIN" '{"name":"=1+1+cmd|calc"}'
INJ_VENDOR=$(q 'o.id')
"$CURL_BIN" -s -H "Authorization: Bearer $ADMIN" "$API/reports/vendors?format=csv" -o "$WORK_DIR/inj.csv" >/dev/null
SAFE=$("$NODE_BIN" -e "
const t=require('fs').readFileSync('$WORK_DIR/inj.csv','utf8');
const line=t.split(String.fromCharCode(13,10)).find(l=>l.includes('1+1'));
console.log(line && line.includes(\"'=1+1\") ? 'protegido' : 'vulneravel');
")
check "$([ "$SAFE" = 'protegido' ]; echo $?)" 'CSV injection neutralizada' "celula=$SAFE"
call DELETE "/vendors/$INJ_VENDOR" "$ADMIN"

# ---------------------------------------------------------------------------
echo "--- 10. Importacao CSV (criterios 19-20) ---"
prev() { "$CURL_BIN" -s -o "$OUT" -w "%{http_code}" -X POST "$API/imports/$1/preview" -H "Authorization: Bearer $ADMIN" -F "file=@$2;type=text/csv"; }
commit() { "$CURL_BIN" -s -o "$OUT" -w "%{http_code}" -X POST "$API/imports/$1/commit" -H "Authorization: Bearer $ADMIN" -F "file=@$2;type=text/csv"; }

CODE=$(prev professionals "$WORK_DIR/imp-prof.csv")
check "$([ "$CODE" = '200' ] && [ "$(q 'o.total')" = '5' ] && [ "$(q 'o.valid')" = '1' ] && [ "$(q 'o.invalid')" = '4' ]; echo $?)" \
  'preview de profissionais' "total=$(q 'o.total') validos=$(q 'o.valid') invalidos=$(q 'o.invalid')"
[ "$(q 'o.columns.length')" = '5' ]
check $? 'preview devolve as colunas do modelo' "colunas=$(q 'o.columns.length')"

CODE=$(commit professionals "$WORK_DIR/imp-prof.csv")
check "$([ "$CODE" = '201' ] && [ "$(q 'o.imported')" = '1' ] && [ "$(q 'o.skipped')" = '4' ]; echo $?)" \
  'commit importa apenas as linhas validas' "importados=$(q 'o.imported') ignorados=$(q 'o.skipped')"

call GET "/professionals?search=importe.um@suporte.local" "$ADMIN"
check "$([ "$(q 'o.data.length')" -ge 1 ]; echo $?)" 'registro importado existe' "encontrados=$(q 'o.data.length')"

CODE=$(commit professionals "$WORK_DIR/imp-prof.csv")
check "$([ "$(q 'o.imported')" = '0' ] && [ "$(q 'o.skipped')" = '5' ]; echo $?)" 'nada e importado quando todas as linhas falham' \
  "importados=$(q 'o.imported') erros=$(q 'o.errors.length')"

CODE=$(prev certifications "$WORK_DIR/imp-cert.csv")
check "$([ "$CODE" = '200' ] && [ "$(q 'o.invalid')" = '4' ]; echo $?)" 'preview de certificacoes' "validos=$(q 'o.valid') invalidos=$(q 'o.invalid')"

printf 'professional_email,vendor,certification,obtained_at,expires_at\ncarlos.souza@suporte.local,Red Hat,Red Hat Certified Engineer (RHCE),2026-01-10,2026-02-30\n' > "$WORK_DIR/imp-bad-date.csv"
CODE=$(prev certifications "$WORK_DIR/imp-bad-date.csv")
HAS_DATE_ERROR=$(q "o.rows[0].errors.join('|')")
check "$([ "$CODE" = '200' ] && [ "$(q 'o.invalid')" = '1' ]; echo $?)" 'CSV rejeita data inexistente (2026-02-30)' "erro=$(echo "$HAS_DATE_ERROR" | cut -c1-40)"

CODE=$("$CURL_BIN" -s -o "$OUT" -w "%{http_code}" -X POST "$API/imports/professionals/preview" -H "Authorization: Bearer $CONSULTANT" -F "file=@$WORK_DIR/imp-prof.csv;type=text/csv")
check "$([ "$CODE" = '403' ]; echo $?)" 'CONSULTANT nao importa -> 403' "http=$CODE"

CODE=$("$CURL_BIN" -s -o "$OUT" -w "%{http_code}" -X POST "$API/imports/professionals/preview" -H "Authorization: Bearer $ADMIN" -F "file=@$WORK_DIR/imp-empty.csv;type=text/csv")
check "$([ "$CODE" = '400' ]; echo $?)" 'arquivo vazio -> 400' "http=$CODE"

# ---------------------------------------------------------------------------
echo "--- 11. Frontend/proxy ---"
CODE=$("$CURL_BIN" -s -o /dev/null -w "%{http_code}" "$WEB/")
check "$([ "$CODE" = '200' ]; echo $?)" 'frontend responde (dev server)' "http=$CODE"
CODE=$("$CURL_BIN" -s -o "$OUT" -w "%{http_code}" -X POST "$WEB/api/v1/imports/professionals/preview" -H "Authorization: Bearer $ADMIN" -F "file=@$WORK_DIR/imp-prof.csv;type=text/csv")
check "$([ "$CODE" = '200' ] && [ "$(q 'o.total')" = '5' ]; echo $?)" 'proxy do frontend encaminha multipart' "http=$CODE total=$(q 'o.total')"

# ---------------------------------------------------------------------------
echo "--- 11b. Tec News ---"
call GET /news "$ADMIN"
NEWS_TOTAL=$(q 'o.meta.total')
check "$([ "$CODE" = '200' ] && [ "$NEWS_TOTAL" -ge 6 ]; echo $?)" 'ADMIN lista novidades (seed DEMO)' "http=$CODE total=$NEWS_TOTAL"

call GET /news/summary "$ADMIN"
check "$([ "$CODE" = '200' ] && [ "$(q 'o.total')" -ge 6 ] && [ "$(q 'typeof o.unread')" = 'number' ]; echo $?)" \
  'resumo (contadores) do Tec News' "total=$(q 'o.total') nao_lidas=$(q 'o.unread')"

call GET /news "$CONSULTANT"
check "$([ "$CODE" = '200' ]; echo $?)" 'CONSULTANT acessa o Tec News' "http=$CODE"

call POST /news "$CONSULTANT" '{"title":"x","url":"https://example.com/x"}'
check "$([ "$CODE" = '403' ]; echo $?)" 'CONSULTANT nao curou novidades -> 403' "http=$CODE"
call GET /news/sources "$CONSULTANT"
check "$([ "$CODE" = '403' ]; echo $?)" 'CONSULTANT nao administra fontes -> 403' "http=$CODE"
call POST /news/sync "$CONSULTANT"
check "$([ "$CODE" = '403' ]; echo $?)" 'CONSULTANT nao dispara sincronizacao -> 403' "http=$CODE"

call POST /news "$ADMIN" "{\"title\":\"QA Novidade $TS\",\"url\":\"https://example.com/qa/news-$TS\",\"kind\":\"FEATURE\",\"vendorId\":\"ven-redhat\"}"
QA_NEWS=$(q 'o.id')
check "$([ "$CODE" = '201' ] && [ "$(q 'o.origin')" = 'manual' ] && [ "$(q 'o.kind')" = 'FEATURE' ]; echo $?)" \
  'curadoria manual de novidade -> 201' "http=$CODE origin=$(q 'o.origin')"
call POST /news "$ADMIN" "{\"title\":\"Duplicada\",\"url\":\"https://example.com/qa/news-$TS\"}"
check "$([ "$CODE" = '409' ]; echo $?)" 'link duplicado -> 409' "http=$CODE"

call PATCH "/news/$QA_NEWS/read" "$CONSULTANT" '{"read":true}'
check "$([ "$CODE" = '200' ]; echo $?)" 'marcar novidade como lida' "http=$CODE"
call GET "/news/$QA_NEWS" "$CONSULTANT"
check "$([ "$(q 'o.read')" = 'true' ]; echo $?)" 'leitura do consultor registrada' "read=$(q 'o.read')"
call GET "/news/$QA_NEWS" "$ADMIN"
check "$([ "$(q 'o.read')" = 'false' ]; echo $?)" 'leitura e por usuario (admin nao afetado)' "admin_read=$(q 'o.read')"

call PATCH "/news/$QA_NEWS/save" "$ADMIN" '{"saved":true}'
call GET "/news?search=QA%20Novidade%20$TS&saved=true" "$ADMIN"
check "$([ "$CODE" = '200' ] && [ "$(q 'o.data.length')" = '1' ]; echo $?)" 'filtro de novidades salvas' "itens=$(q 'o.data.length')"

call PATCH "/news/$QA_NEWS/pin" "$MANAGER" '{"pinned":true}'
check "$([ "$CODE" = '200' ] && [ "$(q 'o.pinned')" = 'true' ]; echo $?)" 'MANAGER fixa destaque' "http=$CODE pinned=$(q 'o.pinned')"

call POST /news/sources "$ADMIN" "{\"vendorId\":\"ven-redhat\",\"name\":\"QA Fonte $TS\",\"url\":\"https://example.com/qa-feed-$TS.xml\",\"connectorType\":\"RSS\"}"
QA_SRC=$(q 'o.id')
check "$([ "$CODE" = '201' ] && [ "$(q 'o.connectorType')" = 'RSS' ]; echo $?)" 'cadastrar fonte RSS -> 201' "http=$CODE"
call POST /news/sources "$ADMIN" "{\"vendorId\":\"ven-redhat\",\"name\":\"QA Fonte sem URL $TS\",\"connectorType\":\"RSS\"}"
check "$([ "$CODE" = '400' ]; echo $?)" 'fonte automatica sem URL -> 400' "http=$CODE"
call PATCH "/news/sources/$QA_SRC/status" "$ADMIN" '{"active":false}'
check "$([ "$CODE" = '200' ] && [ "$(q 'o.active')" = 'false' ]; echo $?)" 'desativar fonte (soft)' "http=$CODE"
call DELETE "/news/sources/$QA_SRC" "$ADMIN"
check "$([ "$CODE" = '204' ]; echo $?)" 'remover fonte -> 204' "http=$CODE"

call DELETE "/news/$QA_NEWS" "$ADMIN"
check "$([ "$CODE" = '204' ]; echo $?)" 'remover novidade -> 204' "http=$CODE"
call GET "/news?search=QA%20Novidade%20$TS" "$ADMIN"
check "$([ "$(q 'o.data.length')" = '0' ]; echo $?)" 'novidade removida some da lista' "itens=$(q 'o.data.length')"

# ---------------------------------------------------------------------------
echo "--- 11c. Releases (D-021) ---"
call GET /releases "$ADMIN"
check "$([ "$CODE" = '200' ] && [ "$(q 'o.meta.total')" -ge 5 ]; echo $?)" 'ADMIN lista releases' "http=$CODE total=$(q 'o.meta.total')"
check "$([ "$(q "o.data.filter(r=>r.current).length")" = '1' ]; echo $?)" 'exatamente uma versao atual' "currents=$(q "o.data.filter(r=>r.current).length")"

call GET /releases "$CONSULTANT"
check "$([ "$CODE" = '403' ]; echo $?)" 'CONSULTANT nao acessa releases -> 403' "http=$CODE"
call POST /releases "$CONSULTANT" '{"version":"9.9.9","title":"x","releasedAt":"2026-10-01"}'
check "$([ "$CODE" = '403' ]; echo $?)" 'CONSULTANT nao cria release -> 403' "http=$CODE"

call POST /releases "$ADMIN" "{\"version\":\"9.9.$TS\",\"title\":\"QA Release $TS\",\"summary\":\"teste\",\"releasedAt\":\"2026-10-01\",\"items\":[{\"category\":\"FEATURE\",\"description\":\"nova\"},{\"category\":\"FIX\",\"description\":\"correcao\"}]}"
QA_REL=$(q 'o.id')
check "$([ "$CODE" = '201' ] && [ "$(q 'o.items.length')" = '2' ]; echo $?)" 'criar release com itens -> 201' "http=$CODE itens=$(q 'o.items.length')"

call POST /releases "$ADMIN" "{\"version\":\"9.9.$TS\",\"title\":\"dup\",\"releasedAt\":\"2026-10-01\"}"
check "$([ "$CODE" = '409' ]; echo $?)" 'versao duplicada -> 409' "http=$CODE"
call POST /releases "$ADMIN" '{"version":"1.2","title":"invalida","releasedAt":"2026-10-01"}'
check "$([ "$CODE" = '400' ]; echo $?)" 'versao fora do formato X.Y.Z -> 400' "http=$CODE"

call PATCH "/releases/$QA_REL/current" "$ADMIN"
check "$([ "$CODE" = '200' ] && [ "$(q 'o.current')" = 'true' ]; echo $?)" 'tornar versao atual' "http=$CODE"
call GET "/releases?current=true" "$ADMIN"
check "$([ "$(q 'o.data.length')" = '1' ] && [ "$(q 'o.data[0].version')" = "9.9.$TS" ]; echo $?)" 'apenas uma versao atual apos a troca' "versao=$(q 'o.data[0].version')"

call PUT "/releases/$QA_REL" "$ADMIN" '{"title":"QA Release v2","items":[{"category":"SECURITY","description":"ajuste"}]}'
check "$([ "$CODE" = '200' ] && [ "$(q 'o.title')" = 'QA Release v2' ] && [ "$(q 'o.items.length')" = '1' ]; echo $?)" 'editar release (substitui itens)' "http=$CODE itens=$(q 'o.items.length')"

call DELETE "/releases/$QA_REL" "$ADMIN"
check "$([ "$CODE" = '204' ]; echo $?)" 'remover release -> 204' "http=$CODE"
call GET "/releases?search=9.9.$TS" "$ADMIN"
check "$([ "$(q 'o.meta.total')" = '0' ]; echo $?)" 'release removida some da lista' "total=$(q 'o.meta.total')"

# ---------------------------------------------------------------------------
echo "--- 11d. Tec News: resumo inteligente (D-022) ---"
call GET "/news?sort=relevanceScore&order=desc" "$ADMIN"
check "$([ "$CODE" = '200' ] && [ "$(q 'o.data[0].relevanceScore')" -ge 1 ]; echo $?)" \
  'novidades ordenadas por relevancia' "http=$CODE score=$(q 'o.data[0].relevanceScore')"
check "$([ "$(q 'typeof o.data[0].relevanceFocus')" = 'string' ]; echo $?)" \
  'foco de relevancia classificado' "foco=$(q 'o.data[0].relevanceFocus')"

call GET /news/digest "$CONSULTANT"
check "$([ "$CODE" = '200' ] && [ "$(q 'typeof o.aiEnabled')" = 'boolean' ]; echo $?)" \
  'CONSULTANT le o resumo (destaques)' "http=$CODE"
call POST /news/digest "$CONSULTANT"
check "$([ "$CODE" = '403' ]; echo $?)" 'CONSULTANT nao gera resumo -> 403' "http=$CODE"
call GET /news/digest "$ADMIN"
check "$([ "$CODE" = '200' ] && [ "$(q 'o.digest')" = 'null' ]; echo $?)" \
  'sem resumo gerado no estado DEMO' "digest=$(q 'o.digest')"
call POST /news/digest "$ADMIN"
check "$([ "$CODE" = '503' ]; echo $?)" \
  'IA desligada -> 503 (degradacao graciosa)' "http=$CODE"

# ---------------------------------------------------------------------------
echo "--- 11e. Configuracoes: IA (D-023) ---"
call GET /settings/ai "$ADMIN"
check "$([ "$CODE" = '200' ] && [ "$(q 'typeof o.baseUrl')" = 'string' ] && [ "$(q 'typeof o.model')" = 'string' ]; echo $?)" \
  'ADMIN le a configuracao de IA' "http=$CODE baseUrl=$(q 'o.baseUrl')"
check "$([ "$(q 'typeof o.apiKey')" = 'undefined' ]; echo $?)" \
  'configuracao nao expoe a chave da API' "apiKey=$(q 'typeof o.apiKey')"

call GET /settings/ai "$CONSULTANT"
check "$([ "$CODE" = '403' ]; echo $?)" 'CONSULTANT nao acessa configuracoes -> 403' "http=$CODE"
call PUT /settings/ai "$MANAGER" '{"enabled":true}'
check "$([ "$CODE" = '403' ]; echo $?)" 'MANAGER nao grava configuracoes -> 403' "http=$CODE"

call PUT /settings/ai "$ADMIN" '{"enabled":true,"baseUrl":"http://127.0.0.1:4999/v1","model":"gpt-4o-mini","timeoutMs":5000,"apiKey":"sk-qa-secret","digestEnabled":true,"digestWindowDays":7,"digestMaxItems":10}'
check "$([ "$CODE" = '200' ] && [ "$(q 'o.apiKeySet')" = 'true' ] && [ "$(q 'o.apiKeySource')" = 'settings' ]; echo $?)" \
  'ADMIN salva a configuracao de IA (chave cifrada)' "http=$CODE source=$(q 'o.apiKeySource')"

call POST /settings/ai/test "$ADMIN" '{"baseUrl":"http://127.0.0.1:1/v1","model":"x","timeoutMs":1000,"apiKey":"sk-qa-secret"}'
check "$([ "$CODE" = '400' ]; echo $?)" 'teste com provedor inacessivel -> 400' "http=$CODE"

call GET /news/digest "$CONSULTANT"
check "$([ "$(q 'o.aiEnabled')" = 'true' ]; echo $?)" 'IA passa a valer apos salvar a configuracao' "aiEnabled=$(q 'o.aiEnabled')"

call PUT /settings/ai "$ADMIN" '{"enabled":false,"clearApiKey":true}'
call GET /news/digest "$CONSULTANT"
check "$([ "$(q 'o.aiEnabled')" = 'false' ]; echo $?)" 'desligar e limpar a chave desativa a IA' "aiEnabled=$(q 'o.aiEnabled')"

# ---------------------------------------------------------------------------
echo "--- 12. Limpeza: restaura o estado DEMO ---"
if [ "$RESET_DEMO" = '1' ]; then
  # Rede de seguranca: dump do banco ANTES de apagar (best-effort). Desative
  # com SKIP_BACKUP=1. Se o backup falhar e houver dados reais (ALLOW_DATA_LOSS=1
  # foi necessario), aborta para nao destruir sem uma copia.
  BACKUP_SH="$(dirname "$0")/backup-db.sh"
  if [ "${SKIP_BACKUP:-0}" != '1' ] && [ -f "$BACKUP_SH" ]; then
    echo "[backup] gerando dump de seguranca antes da limpeza..."
    if DB_USER="$DB_USER" DB_HOST="$DB_HOST" DB_PORT="$DB_PORT" DB_NAME="$DB_NAME" \
       PGPASSWORD="${PGPASSWORD:-}" PG_DUMP_BIN="${PG_DUMP_BIN:-pg_dump}" \
       bash "$BACKUP_SH"; then
      echo "[backup] ok"
    else
      echo "[backup] FALHOU"
      if [ "${ALLOW_DATA_LOSS:-0}" = '1' ]; then
        echo "[ABORT] Ha dados reais e o backup falhou. Nao vou apagar sem copia."
        echo "        Corrija o backup, use SKIP_BACKUP=1 para assumir o risco, ou RESET_DEMO=0."
        exit 1
      fi
    fi
  fi
  "$PSQL_BIN" -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -q -c "
DELETE FROM audit_logs;
DELETE FROM app_settings;
DELETE FROM releases;
DELETE FROM news_digests;
DELETE FROM news_read_states;
DELETE FROM news_items;
DELETE FROM news_sources;
DELETE FROM professional_certifications;
DELETE FROM roadmap_items;
DELETE FROM certifications;
DELETE FROM technologies;
DELETE FROM vendors;
DELETE FROM refresh_tokens;
DELETE FROM professionals;"
  ( cd "$BACKEND_DIR" && "$NPM_BIN" run seed >/dev/null 2>&1 )
  STATE="$([ "$(count 'SELECT count(*) FROM professionals')" = '6' ] && [ "$(count 'SELECT count(*) FROM professional_certifications')" = '11' ] && [ "$(count 'SELECT count(*) FROM audit_logs')" = '0' ] && [ "$(count 'SELECT count(*) FROM news_items')" = '6' ] && [ "$(count 'SELECT count(*) FROM news_sources')" = '5' ] && [ "$(count 'SELECT count(*) FROM news_digests')" = '0' ] && [ "$(count 'SELECT count(*) FROM app_settings')" = '0' ] && [ "$(count 'SELECT count(*) FROM releases')" = '6' ]; echo $?)"
  check "$STATE" 'estado DEMO restaurado apos os testes' "6 profissionais / 11 vinculos / auditoria limpa / 6 noticias / 5 fontes / 0 resumos / 0 configs / 6 releases"
else
  echo "[SKIP] restauracao do seed (RESET_DEMO=0)"
fi
rm -f "$COOKIES" "$WORK_DIR/report.csv" "$WORK_DIR/inj.csv" "$WORK_DIR/csv-headers.txt" "$WORK_DIR/imp-bad-date.csv"

echo "=================================================================="
echo "RESUMO: $PASS PASS / $FAIL FAIL"
echo "=================================================================="
[ "$FAIL" = '0' ] || exit 1
