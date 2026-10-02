# Board — kai-20261001-1647-calendario-academico

Log append-only de fatos que afetam outras tasks desta execução: contrato divergente, símbolo renomeado, arquivo compartilhado alterado, decisão que outra task precisa conhecer. Uma linha por fato, acrescentada por append com heredoc (abaixo; o delimitador entre aspas aceita qualquer caractere no fato); nunca edite ou remova linhas. Leia antes de começar uma task e antes de usar cada `Consome`. O fechador consolida as linhas em `notes.md § Descobertas`.

Formato: `- [T-NN] <fato>`

Append:

```bash
cat >> "/home/kaine/source/geduc-rag/.claude/tasks/kai-20261001-1647-calendario-academico/board.md" <<'EOF'
- [T-NN] <fato>
EOF
```
- [T-04] `update` do repositório só substitui vínculos quando `schoolIds` é definido; ao virar `allSchools: true`, o service (T-06) deve mandar `schoolIds: []` para limpar as linhas antigas. Dias de calendário excluído não são lidos (join com `c.deleted_at IS NULL`).
- [T-06] `AcademicCalendarModule` pronto em `backend/src/modules/academic-calendar/academic-calendar.module.ts` (não registrado; T-07). `PATCH /academic-calendars/:id/days/:date` valida params via `CalendarDayParamsDto` (`id` UUID + `date` YYYY-MM-DD estrito → 400); `GET /:id/days` e `PATCH /:id/days/:date` respondem 404 `CALENDAR_NOT_FOUND` para calendário inexistente/excluído antes de ler dias.
