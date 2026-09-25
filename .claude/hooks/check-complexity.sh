#!/bin/bash
set -euo pipefail

INPUT="$(cat)"
EVENT_NAME="$(printf '%s' "$INPUT" | jq -r '.hook_event_name // empty' 2>/dev/null || true)"

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
BASE_REF="${COMPLEXITY_BASE_REF:-HEAD}"
TS_LIMIT="${COMPLEXITY_TS_LIMIT:-12}"
DART_LIMIT="${COMPLEXITY_DART_LIMIT:-18}"

cd "$PROJECT_DIR"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

tracked_changed="$(git diff --name-only --diff-filter=ACMR "$BASE_REF" 2>/dev/null || true)"
untracked_changed="$(git ls-files --others --exclude-standard 2>/dev/null || true)"
changed_files="$(printf '%s\n%s\n' "$tracked_changed" "$untracked_changed" | sed '/^$/d' | sort -u)"

ts_files="$(printf '%s\n' "$changed_files" | grep -E '^backend/src/.*\.ts$' || true)"
dart_files="$(printf '%s\n' "$changed_files" | grep -E '^frontend/lib/.*\.dart$' || true)"

if [ -z "$ts_files" ] && [ -z "$dart_files" ]; then
  exit 0
fi

failures=""
warnings=""

append_failure() {
  failures="${failures}
$1"
}

append_warning() {
  warnings="${warnings}
$1"
}

if [ -n "$ts_files" ]; then
  if [ ! -x backend/node_modules/.bin/eslint ]; then
    append_warning "Backend: ESLint local não encontrado em backend/node_modules/.bin/eslint. Rode npm install no backend para ativar a checagem automática de complexidade TypeScript."
  else
    backend_files="$(printf '%s\n' "$ts_files" | sed 's#^backend/##')"

    set +e
    ts_output="$(
      cd backend &&
        ./node_modules/.bin/eslint $backend_files \
          --rule "complexity: [error, { max: $TS_LIMIT }]" \
          --format stylish 2>&1
    )"
    ts_exit=$?
    set -e

    if [ "$ts_exit" -ne 0 ]; then
      append_failure "Backend TypeScript: complexidade ciclomática acima do limite $TS_LIMIT.
$ts_output"
    fi
  fi
fi

if [ -n "$dart_files" ]; then
  if ! command -v node >/dev/null 2>&1; then
    append_warning "Frontend Dart: node não encontrado; checagem heurística de complexidade Dart não foi executada."
  else
  set +e
  dart_output="$(
    DART_FILES="$dart_files" node - "$DART_LIMIT" <<'NODE'
const fs = require('fs');

const limit = Number(process.argv[2] || 18);
const input = (process.env.DART_FILES || '').trim();
const files = input ? input.split(/\n+/).filter(Boolean) : [];

function stripLine(raw, state) {
  let line = '';
  let i = 0;

  while (i < raw.length) {
    if (state.blockComment) {
      const end = raw.indexOf('*/', i);
      if (end === -1) return '';
      state.blockComment = false;
      i = end + 2;
      continue;
    }

    if (raw.startsWith('/*', i)) {
      state.blockComment = true;
      i += 2;
      continue;
    }

    if (raw.startsWith('//', i)) break;

    line += raw[i];
    i += 1;
  }

  return line
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

function countDecisionPoints(line) {
  let count = 0;
  const keywordMatches = line.match(/\b(if|for|while|case|catch)\b/g);
  if (keywordMatches) count += keywordMatches.length;
  count += (line.match(/&&/g) || []).length;
  count += (line.match(/\|\|/g) || []).length;
  count += (line.match(/\?[^?:]/g) || []).length;
  return count;
}

function guessName(signature) {
  const cleaned = signature.replace(/\s+/g, ' ').trim();
  const build = cleaned.match(/\bbuild\s*\(/);
  if (build) return 'build';

  const fn = cleaned.match(/([A-Za-z_$][\w$]*)\s*(?:<[^>{}]+>)?\s*\([^;{}]*\)\s*(?:async\s*)?(?:sync\s*)?\{/);
  if (fn) return fn[1];

  const arrow = cleaned.match(/(?:final|var|const)?\s*([A-Za-z_$][\w$]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/);
  if (arrow) return arrow[1];

  return cleaned.slice(0, 80) || '<funcao>';
}

function looksLikeFunctionStart(text) {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (!compact.includes('(') || !compact.includes('{')) return false;
  if (/^(if|for|while|switch|catch)\b/.test(compact)) return false;
  if (/\b(class|enum|mixin|extension)\b/.test(compact)) return false;
  return /\)\s*(?:async\s*)?(?:sync\s*)?\{/.test(compact);
}

const findings = [];

for (const file of files) {
  if (!fs.existsSync(file)) continue;

  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const state = { blockComment: false };
  let current = null;
  let pendingSignature = '';

  lines.forEach((raw, idx) => {
    const line = stripLine(raw, state);
    const open = (line.match(/\{/g) || []).length;
    const close = (line.match(/\}/g) || []).length;

    if (!current) {
      pendingSignature = `${pendingSignature} ${line}`.trim();
      if (pendingSignature.length > 500 || /;\s*$/.test(line)) {
        pendingSignature = '';
      }

      if (looksLikeFunctionStart(pendingSignature)) {
        current = {
          name: guessName(pendingSignature),
          startLine: idx + 1,
          complexity: 1 + countDecisionPoints(line),
          depth: open - close,
        };
        pendingSignature = '';

        if (current.depth <= 0) {
          if (current.complexity > limit) findings.push({ file, ...current });
          current = null;
        }
        return;
      }
    } else {
      current.complexity += countDecisionPoints(line);
      current.depth += open - close;

      if (current.depth <= 0) {
        if (current.complexity > limit) findings.push({ file, ...current });
        current = null;
      }
    }
  });
}

for (const finding of findings) {
  console.log(`${finding.file}:${finding.startLine} ${finding.name} complexity ${finding.complexity} > ${limit}`);
}

process.exit(findings.length ? 1 : 0);
NODE
  )"
  dart_exit=$?
  set -e

  if [ "$dart_exit" -ne 0 ]; then
    append_failure "Frontend Dart: complexidade estimada acima do limite $DART_LIMIT.
$dart_output
Observação: esta checagem usa uma heurística local por ausência de analisador Dart dedicado."
  fi
  fi
fi

if [ -z "$failures" ]; then
  if [ -n "$warnings" ]; then
    printf '%s\n' "$warnings" >&2
  fi
  exit 0
fi

reason="Complexidade ciclomática acima do limite nos arquivos alterados.
$failures"

if [ -n "$warnings" ]; then
  reason="$reason

Avisos:
$warnings"
fi

case "$EVENT_NAME" in
  Stop)
    jq -n --arg reason "$reason" '{decision: "block", reason: $reason}'
    exit 0
    ;;
  TaskCompleted)
    printf '%s\n' "$reason" >&2
    exit 2
    ;;
  *)
    printf '%s\n' "$reason" >&2
    exit 2
    ;;
esac
