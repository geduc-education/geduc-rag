# Board — kai-20260930-0848-remover-prisma-sem-orm

Log append-only de fatos que afetam outras tasks desta execução: contrato divergente, símbolo renomeado, arquivo compartilhado alterado, decisão que outra task precisa conhecer. Uma linha por fato, acrescentada por append com heredoc (abaixo; o delimitador entre aspas aceita qualquer caractere no fato); nunca edite ou remova linhas. Leia antes de começar uma task e antes de usar cada `Consome`. O fechador consolida as linhas em `notes.md § Descobertas`.

Formato: `- [T-NN] <fato>`

Append:

```bash
cat >> "/home/kaine/source/geduc-rag/.claude/tasks/kai-20260930-0848-remover-prisma-sem-orm/board.md" <<'EOF'
- [T-NN] <fato>
EOF
```
- [T-01] `DATABASE_CONNECTION`/`IDatabaseConnection` prontos (commit 714a370). `ensureSafeWhere` também recusa `/*` e qualquer `#`/`--` no SQL inteiro, e exige operador (`=`, `<>`, `!=`, `<`, `>`, `IN (`, `IS [NOT] NULL`, `LIKE`, `BETWEEN`, `EXISTS`) depois do primeiro `WHERE`. O `update`/`delete` só servem para UPDATE/DELETE com WHERE; `INSERT … ON DUPLICATE KEY UPDATE` vai por `insert`.
