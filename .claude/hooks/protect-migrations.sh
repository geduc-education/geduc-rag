#!/bin/bash
# PreToolUse (Edit|Write) — protege migrations SQL já versionadas.
# O runner (backend/database/migrate.ts) grava o checksum de cada migration
# aplicada em `schema_migrations`; editar uma delas quebra essa verificação.
# Mudança de schema nasce como migration nova, não como edição.
# Decisão "ask": o caso legítimo (ajustar migration recém-criada e ainda não
# aplicada em nenhum ambiente) continua possível com confirmação do usuário.
INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

[ -z "$FILE" ] && exit 0

case "$FILE" in
  */backend/database/migrations/*)
    jq -cn --arg reason "Edição manual em backend/database/migrations/ — migration aplicada tem checksum em schema_migrations; crie uma nova em vez de editar. Confirme apenas se a migration ainda não foi aplicada." '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: $reason
      }
    }'
    ;;
esac

exit 0
