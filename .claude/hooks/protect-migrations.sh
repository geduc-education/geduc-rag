#!/bin/bash
# PreToolUse (Edit|Write) — protege migrations Prisma já geradas.
# Editar uma migration aplicada corrompe o histórico do Prisma (checksum);
# migrations devem nascer de `npx prisma migrate dev`, não de edição manual.
# Decisão "ask": o caso legítimo (ajustar migration recém-gerada e ainda não
# aplicada em outros ambientes) continua possível com confirmação do usuário.
INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

[ -z "$FILE" ] && exit 0

case "$FILE" in
  */backend/prisma/migrations/*)
    jq -cn --arg reason "Edição manual em backend/prisma/migrations/ — migrations aplicadas não devem ser alteradas (corrompe o checksum do Prisma). Confirme apenas se a migration ainda não foi aplicada." '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: $reason
      }
    }'
    ;;
esac

exit 0
