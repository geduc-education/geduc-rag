#!/bin/bash
# PreToolUse (Bash) — salvaguarda contra comandos destrutivos de banco.
# Política: DELETE sem WHERE é negado; todo o resto destrutivo (DROP, TRUNCATE,
# ALTER ... DROP, dropdb, DELETE com WHERE) vira "ask" — o usuário confirma
# manualmente, como manda o CLAUDE.md.
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

[ -z "$COMMAND" ] && exit 0

# normaliza pra maiúsculas pra checagem case-insensitive
CMD_UPPER=$(echo "$COMMAND" | tr '[:lower:]' '[:upper:]')

ask() {
  jq -cn --arg reason "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
}

# DELETE sem WHERE: nega direto — quase nunca é intencional
if echo "$CMD_UPPER" | grep -Eq 'DELETE\s+FROM' && ! echo "$CMD_UPPER" | grep -q 'WHERE'; then
  echo "Bloqueado: DELETE sem cláusula WHERE não é permitido." >&2
  exit 2
fi

# CLI destrutivo: dropdb
if echo "$CMD_UPPER" | grep -Eq '(^|[^A-Z])DROPDB([^A-Z]|$)'; then
  ask "Comando destrutivo de banco (dropdb). Regra do projeto: só com confirmação manual."
fi

# SQL destrutivo: DROP, TRUNCATE, ALTER ... DROP, DELETE (com WHERE)
if echo "$CMD_UPPER" | grep -Eq 'DROP\s+(TABLE|DATABASE|SCHEMA)|TRUNCATE|ALTER\s+TABLE.*DROP|DELETE\s+FROM'; then
  ask "SQL destrutivo detectado. Regra do projeto: só com confirmação manual."
fi

exit 0
