# Board — kai-20261002-1116-horario-academico

Log append-only de fatos que afetam outras tasks desta execução: contrato divergente, símbolo renomeado, arquivo compartilhado alterado, decisão que outra task precisa conhecer. Uma linha por fato, acrescentada por append com heredoc (abaixo; o delimitador entre aspas aceita qualquer caractere no fato); nunca edite ou remova linhas. Leia antes de começar uma task e antes de usar cada `Consome`. O fechador consolida as linhas em `notes.md § Descobertas`.

Formato: `- [T-NN] <fato>`

Append:

```bash
cat >> "/home/kaine/source/geduc-rag/.claude/tasks/kai-20261002-1116-horario-academico/board.md" <<'EOF'
- [T-NN] <fato>
EOF
```
- [T-05] `IWeeklyScheduleRepository`/`WEEKLY_SCHEDULE_REPOSITORY` e records conforme a Interface de T-05; `saveWeeks` gera os ids dos `creates` (randomUUID) e devolve `created`/`replaced` relidos na transação, na ordem dos inputs; métodos de escrita sem `tx?` (contrato literal).
