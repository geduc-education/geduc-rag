#!/bin/bash
# PostToolUse (Edit|Write) — formata o arquivo recém-editado.
# backend/*.ts  → eslint --fix (usa a config do projeto)
# frontend/*.dart → fvm dart format
# Sempre sai 0: formatação nunca deve bloquear o fluxo.
INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

[ -z "$FILE" ] && exit 0
[ ! -f "$FILE" ] && exit 0

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

case "$FILE" in
  *"/backend/"*.ts)
    if [ -x "$PROJECT_DIR/backend/node_modules/.bin/eslint" ]; then
      (cd "$PROJECT_DIR/backend" && ./node_modules/.bin/eslint --fix "$FILE" >/dev/null 2>&1)
    fi
    ;;
  *"/frontend/"*.dart)
    if command -v fvm >/dev/null 2>&1; then
      (cd "$PROJECT_DIR/frontend" && fvm dart format "$FILE" >/dev/null 2>&1)
    fi
    ;;
esac

exit 0
