# Board — kai-20260928-1613-novidades-github

Log append-only de fatos que afetam outras tasks desta execução: contrato divergente, símbolo renomeado, arquivo compartilhado alterado, decisão que outra task precisa conhecer. Uma linha por fato, acrescentada por append com heredoc (abaixo; o delimitador entre aspas aceita qualquer caractere no fato); nunca edite ou remova linhas. Leia antes de começar uma task e antes de usar cada `Consome`. O fechador consolida as linhas em `notes.md § Descobertas`.

Formato: `- [T-NN] <fato>`

Append:

```bash
cat >> "/home/kaine/source/geduc-rag/.claude/tasks/kai-20260928-1613-novidades-github/board.md" <<'EOF'
- [T-NN] <fato>
EOF
```
- [T-08] `registerChangelogBinds`/`registerChangelogRoutes` registrados em home_module.dart; `ChangelogController` é lazy singleton do shell (T-11 usa `inject<ChangelogController>()`); `ChangelogTypeBadge`, `changelogTypeIcons` e `changelogTypeShortLabels` em `frontend/lib/modules/changelog/presentation/widgets/changelog_type_badge.dart`; `ChangelogEntryTile` em `widgets/changelog_entry_tile.dart`. Commits 076d9b1 (RED), 883dbd1.
