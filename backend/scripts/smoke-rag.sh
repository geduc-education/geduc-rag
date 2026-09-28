#!/usr/bin/env bash
# Smoke ponta a ponta do assistente RAG contra os serviços reais
# (MySQL, embeddings locais, Ollama). Não lê .env: tudo vem por variável.
#
# Uso:
#   API_URL=http://localhost:3000 SMOKE_EMAIL=<email> SMOKE_PASSWORD=<senha> \
#   SMOKE_TENANT_ID=<tenant> bash backend/scripts/smoke-rag.sh
#
# Passos: login → upload multipart → polling de status até `ready` →
# POST /chat/query → DELETE do documento. Sai 0 com `SMOKE PASS`; em falha
# imprime `SMOKE FAIL: <etapa>` e sai 1.
set -uo pipefail

API_URL="${API_URL:-http://localhost:3000}"
SMOKE_TIMEOUT_S="${SMOKE_TIMEOUT_S:-180}"
SMOKE_CHAT_TIMEOUT_S="${SMOKE_CHAT_TIMEOUT_S:-300}"
SMOKE_QUESTION="${SMOKE_QUESTION:-Qual é a senha do armário de reagentes do Laboratório Aurora?}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURE="${SCRIPT_DIR}/fixtures/smoke-doc.md"

TOKEN=""
DOCUMENT_ID=""
BODY=""
HTTP_CODE=""

fail() {
  local step="$1" detail="${2:-}"
  echo "SMOKE FAIL: ${step}"
  [ -n "$detail" ] && echo "$detail"
  cleanup
  exit 1
}

# Faz a request e separa corpo (BODY) e status HTTP (HTTP_CODE).
request() {
  local out
  out="$(curl -sS -w $'\n%{http_code}' "$@")" || { BODY="sem resposta de ${API_URL}"; HTTP_CODE="000"; return 1; }
  HTTP_CODE="${out##*$'\n'}"
  BODY="${out%$'\n'*}"
}

auth_request() {
  request -H "Authorization: Bearer ${TOKEN}" -H "tenant-id: ${SMOKE_TENANT_ID}" "$@"
}

# Remove o documento se a falha acontecer depois do upload.
cleanup() {
  [ -z "$DOCUMENT_ID" ] && return 0
  local id="$DOCUMENT_ID"
  DOCUMENT_ID=""
  auth_request -X DELETE "${API_URL}/documents/${id}" >/dev/null 2>&1 || true
}

require_env() {
  local missing=()
  for var in SMOKE_EMAIL SMOKE_PASSWORD SMOKE_TENANT_ID; do
    [ -z "${!var:-}" ] && missing+=("$var")
  done
  [ "${#missing[@]}" -gt 0 ] && fail "config" "variáveis ausentes: ${missing[*]}"
  command -v jq >/dev/null || fail "config" "jq não encontrado no PATH"
  [ -f "$FIXTURE" ] || fail "config" "fixture ausente: ${FIXTURE}"
}

login() {
  local payload
  payload="$(jq -n --arg e "$SMOKE_EMAIL" --arg p "$SMOKE_PASSWORD" '{email: $e, password: $p}')"
  request -X POST "${API_URL}/auth/login" -H 'Content-Type: application/json' -d "$payload"
  [ "$HTTP_CODE" = "200" ] || fail "login" "HTTP ${HTTP_CODE}: ${BODY}"
  TOKEN="$(jq -r '.accessToken // empty' <<<"$BODY")"
  [ -n "$TOKEN" ] || fail "login" "resposta sem accessToken"
}

upload() {
  auth_request -X POST "${API_URL}/documents" -F "file=@${FIXTURE};type=text/markdown"
  [ "$HTTP_CODE" = "202" ] || fail "upload" "HTTP ${HTTP_CODE}: ${BODY}"
  DOCUMENT_ID="$(jq -r '.documentId // empty' <<<"$BODY")"
  [ -n "$DOCUMENT_ID" ] || fail "upload" "resposta sem documentId: ${BODY}"
  echo "upload ok: documentId=${DOCUMENT_ID}"
}

wait_ready() {
  local deadline=$((SECONDS + SMOKE_TIMEOUT_S)) status=""
  while [ "$SECONDS" -lt "$deadline" ]; do
    auth_request "${API_URL}/documents/${DOCUMENT_ID}/status"
    [ "$HTTP_CODE" = "200" ] || fail "status" "HTTP ${HTTP_CODE}: ${BODY}"
    status="$(jq -r '.status // empty' <<<"$BODY")"
    [ "$status" = "ready" ] && { echo "ingestão ok: status=ready"; return 0; }
    [ "$status" = "failed" ] && fail "status" "documento failed: ${BODY}"
    sleep 2
  done
  fail "status" "timeout de ${SMOKE_TIMEOUT_S}s (último status: ${status:-desconhecido})"
}

chat() {
  local payload answer filename
  payload="$(jq -n --arg q "$SMOKE_QUESTION" '{question: $q}')"
  auth_request -X POST "${API_URL}/chat/query" --max-time "$SMOKE_CHAT_TIMEOUT_S" \
    -H 'Content-Type: application/json' -d "$payload"
  [ "$HTTP_CODE" = "200" ] || fail "chat" "HTTP ${HTTP_CODE}: $(jq -r '.message // empty' <<<"$BODY" 2>/dev/null || echo "$BODY")"
  answer="$(jq -r '.answer // empty' <<<"$BODY")"
  filename="$(jq -r '.citations[0].filename // empty' <<<"$BODY")"
  [ -n "$answer" ] || fail "chat" "resposta vazia: ${BODY}"
  [ -n "$filename" ] || fail "chat" "resposta sem citations[0].filename: ${BODY}"
  CHAT_ANSWER="$answer"
  CHAT_FILENAME="$filename"
}

delete_document() {
  auth_request -X DELETE "${API_URL}/documents/${DOCUMENT_ID}"
  [ "$HTTP_CODE" = "204" ] || fail "delete" "HTTP ${HTTP_CODE}: ${BODY}"
  DOCUMENT_ID=""
}

main() {
  require_env
  login
  upload
  wait_ready
  chat
  delete_document
  echo "resposta: ${CHAT_ANSWER}"
  echo "SMOKE PASS filename=${CHAT_FILENAME}"
}

CHAT_ANSWER=""
CHAT_FILENAME=""
main
