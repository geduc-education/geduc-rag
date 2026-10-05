# Aang — integração e validação integral

subagent_type: general-purpose
model: inherit

## Contexto
Plano: horário acadêmico semanal no backend (turma → horário semanal → dias → aulas com disciplina), ligado ao calendário acadêmico, com CRUD mínimo de disciplinas e turmas. Registra os três módulos novos em `AppModule`, cobre o 403 das rotas novas no e2e e roda a validação integral.

## Tasks atribuídas
- T-07: Registro dos módulos, e2e e validação integral

Leia a especificação completa de cada task (arquivos, Interface, critério de aceite, validação) na seção correspondente de `/home/kaine/source/geduc-rag/.claude/tasks/kai-20261002-1116-horario-academico/tasks.md`. Não leia as demais seções.

## Caminhos relevantes
- `backend/src/app.module.ts`
- `backend/test/app.e2e-spec.ts` (casos de 403 de `/academic-calendars` como molde)
- `backend/test/setup-e2e.ts`
- Board: `/home/kaine/source/geduc-rag/.claude/tasks/kai-20261002-1116-horario-academico/board.md`
- Relatórios: `/home/kaine/source/geduc-rag/.claude/tasks/kai-20261002-1116-horario-academico/reports/` (modelo em `_template.md`)
- Notas: `/home/kaine/source/geduc-rag/.claude/tasks/kai-20261002-1116-horario-academico/notes.md` — leia § Decisões tomadas e § Descobertas antes de começar (rulings de ondas anteriores vivem ali, não no board).

## Ambiente
- Repositório único `/home/kaine/source/geduc-rag` (checkout compartilhado, sem worktree). **Execução sem commits por decisão do usuário:** o trabalho fica no working tree.
- Branch de trabalho `task/horario-de-aula` (a branch atual; base `main`, `206bc5d`). Não crie nem troque de branch.
- **Proibido rodar** `git add`, `git commit`, `git reset`, `git stash`, `git checkout` e `git restore` (nem `git add -A`/`git add .`/`git commit -a`). Git só para leitura: `git status --porcelain`, `git diff 206bc5d -- <seus caminhos>`.
- Comandos rodam em `backend/` (`cd backend && ...`). Validação da task: os comandos do bloco Validação da sua seção em `tasks.md`. Baseline de `npx tsc --noEmit` e `npx eslint "{src,test}/**/*.ts"` vazio (ver `plan.md § Baseline`): qualquer linha de saída é regressão.
- Proibidos: `npm run lint` e `npm run format` (aplicam `--fix`/`prettier --write` no repositório inteiro); `eslint --fix` manual; ler ou imprimir `backend/.env`; `DROP`, `TRUNCATE`, `DELETE` sem `WHERE`; editar migration já aplicada (`0001`–`0004`); qualquer `git add`/`git commit`/`git reset`/`git stash`/`git checkout`/`git restore`; push; tocar `stash@{0}` e qualquer arquivo de `frontend/`; editar `backend/src/modules/schools/**` e `backend/src/modules/academic-calendar/**` (base existente, só leitura).
- Hooks: `format-file.sh` roda `eslint --fix` em cada `.ts` editado (releia o arquivo antes de rodar a validação); `protect-db.sh` pede confirmação para SQL destrutivo; `protect-migrations.sh` pede confirmação em `backend/database/migrations/**`; `check-complexity.sh` bloqueia no Stop acima do limite de complexidade ciclomática — mantenha funções curtas, com early return.
- Pré-requisito para `npm run db:migrate` e a contagem final: MySQL local no ar (`127.0.0.1:3307`, `rag`/`rag`); e2e não usa banco real.

Não commite: a entrega é o working tree, conferido por `git status --porcelain` contra os "Arquivos prováveis" da task. Falha de ambiente (conexão recusada, credencial, túnel fora do ar) não é falha da task: relate-a em Pendências com o comando e a linha do erro, sem contornar.

## Antes de começar
Leia a task, o board e `notes.md`. Se faltar informação que causaria retrabalho ou quebra de contrato, pare **antes de editar qualquer arquivo do projeto**: escreva `reports/T-NN.md` com `Status: precisa de contexto` e até 3 perguntas em `## Perguntas` (`Resposta: pendente`) e responda com esse status e as perguntas em Pendências. A resposta chega por mensagem do orquestrador; registre-a no relatório e siga. Depois da primeira edição, dúvida segue o fluxo de Comunicação (`bloqueado` ou `SendMessage` para `main`).

## Teste primeiro (bloco Teste RED) — sem commits
- **Com teste:**
  1. Escreva só o teste (e as fixtures do bloco) e rode o comando do bloco até ver a falha. Ela precisa vir da ausência do comportamento — asserção falhando ou símbolo que a task produz ainda inexistente —, não de setup, typo ou import errado.
  2. **Antes de editar qualquer arquivo de implementação**, cole em `## RED` do relatório o comando e a saída da falha (trecho com `FAIL` e a mensagem). Essa é a prova de TDD: não há commit RED.
  3. Implemente, rode o mesmo comando até passar e cole a saída passando (`PASS`, `Tests:`) logo abaixo, em `## RED`, marcada "depois da implementação".
- **`sem teste: <motivo>`:** pule 1–3 e copie o motivo em `## RED`.
- O validador confere a ordem pela evidência do relatório e o escopo pelo working tree (`git status --porcelain`, `git diff 206bc5d`): arquivo fora dos "Arquivos prováveis" da task reprova.

## Comunicação
- Leia o board antes de começar e antes de usar cada `Consome`.
- Fato que afeta outras tasks (contrato divergente, símbolo renomeado, arquivo compartilhado alterado): acrescente `- [T-NN] <fato>` ao board por append com heredoc, nunca com Edit — o delimitador entre aspas aceita qualquer caractere no fato, inclusive aspas simples. O `EOF` de fechamento vai na coluna zero, sem indentação:

```bash
cat >> "/home/kaine/source/geduc-rag/.claude/tasks/kai-20261002-1116-horario-academico/board.md" <<'EOF'
- [T-NN] <fato>
EOF
```

- O que bloqueia você ou invalida um `Consome` de outra task: além do board, `SendMessage` para `main` com uma linha: `[T-NN] <fato> — ver /home/kaine/source/geduc-rag/.claude/tasks/kai-20261002-1116-horario-academico/board.md`.
- Mensagem recebida do orquestrador durante a execução tem prioridade sobre o plano.

## Restrições
- Não editar arquivos fora dos listados nas tasks atribuídas, exceto `reports/T-NN.md` e o append em `board.md`.
- Não commitar nem preparar commit: nada de `git add`, `git commit`, `git checkout`, `git reset`, `git stash` ou `git restore` — decisão do usuário, e a árvore é compartilhada com outros agentes da onda.
- Falha em teste de arquivo que não é seu é ruído de task em andamento: rode só o seu arquivo de teste e relate a falha alheia em Pendências, sem corrigir.
- Respeitar literalmente os tokens de "Consome": não redefinir contratos.
- Não despachar sub-agentes (nem revisores, nem ajudantes).
- Não executar comandos destrutivos sem confirmação.
- Não devolver conteúdo integral de arquivos.

## Relatório
Antes de responder, para **cada** task atribuída, copie `reports/_template.md` para `reports/T-NN.md` (um relatório por task) e preencha: `## Perguntas` e `## RED` (sempre, mesmo com "nenhuma" ou `sem teste:`), evidência completa (comando → saída relevante), desvios do plano com motivo, pendências. Correções pedidas depois são anexadas ao mesmo arquivo sob `## Correção N`.

## Retorno (até 120 palavras, exatamente neste formato)
A evidência completa mora em `reports/T-NN.md`; o retorno é o resumo para o orquestrador.
Status: concluído | bloqueado | parcial | precisa de contexto
Arquivos: <caminhos tocados> e reports/T-NN.md de cada task
Evidência: <uma linha: comando → trecho que prova o critério de aceite; o detalhe fica no relatório>
Pendências: <o que falta, as perguntas (precisa de contexto) ou "nenhuma">
