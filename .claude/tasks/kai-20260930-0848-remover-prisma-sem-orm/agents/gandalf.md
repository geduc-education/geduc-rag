# Gandalf — documentação sem Prisma

subagent_type: geduc:documentador
model: sonnet

## Contexto
Plano: remover o Prisma do backend do geduc-rag e adotar `mysql2/promise` com SQL parametrizado no padrão do api-geduc-tenant, sem mudar contratos HTTP nem schema. Atualiza docs, `CLAUDE.md` e agentes para o acesso a dados sem ORM: regras de SQL/repositório no padrão do `check-sql` e a regra nova de migration.

## Tasks atribuídas
- T-15: Docs e agentes sem Prisma

Leia a especificação completa de cada task (arquivos, Interface, critério de aceite, validação) na seção correspondente de `/home/kaine/source/geduc-rag/.claude/tasks/kai-20260930-0848-remover-prisma-sem-orm/tasks.md`. Não leia as demais seções.

## Caminhos relevantes
- Referência: `.claude/skills/check-sql/SKILL.md` e `.claude/skills/new-repository/SKILL.md` em /home/kaine/source/api-geduc-tenant (somente leitura; nunca edite)
- `/home/kaine/source/geduc-rag/.claude/tasks/kai-20260930-0848-remover-prisma-sem-orm/plan.md` § Decisões de arquitetura (o que documentar)
- Board: `/home/kaine/source/geduc-rag/.claude/tasks/kai-20260930-0848-remover-prisma-sem-orm/board.md`
- Relatórios: `/home/kaine/source/geduc-rag/.claude/tasks/kai-20260930-0848-remover-prisma-sem-orm/reports/` (modelo em `_template.md`)
- Notas: `/home/kaine/source/geduc-rag/.claude/tasks/kai-20260930-0848-remover-prisma-sem-orm/notes.md` — leia § Decisões tomadas e § Descobertas antes de começar (rulings de ondas anteriores vivem ali, não no board).

## Ambiente
- Repositório único `/home/kaine/source/geduc-rag` (checkout compartilhado, sem worktree); commite com `git -C /home/kaine/source/geduc-rag`.
- Branch de trabalho `task/remover-prisma-sem-orm` (base `main`).
- Comandos rodam em `backend/`: `npx jest <caminho>`, `npx tsc --noEmit`, `npx eslint "{src,test}/**/*.ts"` (sem `--fix`). Baseline de tsc e eslint vazio: qualquer linha de saída é regressão.
- Proibidos: `npm run lint` e `npm run format` (aplicam `--fix`/`prettier --write` em tudo); qualquer `npx prisma migrate`/`db push`; `DROP`, `TRUNCATE`, `DELETE` sem WHERE; ler ou imprimir `backend/.env`; `git add -A`, `git add .`, `git commit -a`, `git checkout`, `git reset`, `git stash`, `git restore`; push.
- Hooks: `format-file.sh` roda `eslint --fix` em cada `.ts` editado (releia o arquivo antes de commitar); `protect-db.sh` pede confirmação para SQL destrutivo (não contorne); `protect-migrations.sh` pede confirmação em `backend/prisma/migrations/**` (e, depois de T-16, em `backend/database/migrations/**`); `check-complexity.sh` bloqueia no Stop acima do limite de complexidade ciclomática — mantenha funções pequenas.
- Não edite `.claude/settings.json` nem `.claude/tasks/**`. Textos em pt-BR com acentuação.

Commite com `git -C /home/kaine/source/geduc-rag` em cada repositório que a task toca. Falha de ambiente (conexão recusada, credencial, túnel fora do ar) não é falha da task: relate-a em Pendências com o comando e a linha do erro, sem contornar.

## Antes de começar
Leia a task, o board e `notes.md`. Se faltar informação que causaria retrabalho ou quebra de contrato, pare **antes de editar qualquer arquivo do projeto**: escreva `reports/T-NN.md` com `Status: precisa de contexto` e até 3 perguntas em `## Perguntas` (`Resposta: pendente`) e responda com esse status e as perguntas em Pendências. A resposta chega por mensagem do orquestrador; registre-a no relatório e siga. Depois da primeira edição, dúvida segue o fluxo de Comunicação (`bloqueado` ou `SendMessage` para `main`).

## Teste primeiro (bloco Teste RED)
- **Com teste:**
  1. Escreva só o teste (e as fixtures do bloco) e rode o comando do bloco até ver a falha. Ela precisa vir da ausência do comportamento — asserção falhando ou símbolo que a task produz ainda inexistente —, não de setup, typo ou import errado.
  2. `git add <arquivos do teste>` e `git commit -m "<assunto>" -m "Task: T-NN (RED)" -- <arquivos do teste>`; cole comando e saída da falha em `## RED` do relatório, com o hash.
  3. Implemente, veja o teste passar e commite os caminhos da implementação com `-m "Task: T-NN"`.
- **`sem teste: <motivo>`:** pule 1–2 e copie o motivo em `## RED`.
- Todo commit da task leva o trailer — `Task: T-NN (RED)` só no commit do teste falhando; `Task: T-NN` em todos os demais, inclusive correções. O validador confere RED e escopo pelo trailer: commit sem ele reprova, e RED depois da implementação não tem correção.

## Comunicação
- Leia o board antes de começar e antes de usar cada `Consome`.
- Fato que afeta outras tasks (contrato divergente, símbolo renomeado, arquivo compartilhado alterado): acrescente `- [T-NN] <fato>` ao board por append com heredoc, nunca com Edit — o delimitador entre aspas aceita qualquer caractere no fato, inclusive aspas simples. O `EOF` de fechamento vai na coluna zero, sem indentação:

```bash
cat >> "/home/kaine/source/geduc-rag/.claude/tasks/kai-20260930-0848-remover-prisma-sem-orm/board.md" <<'EOF'
- [T-NN] <fato>
EOF
```

- O que bloqueia você ou invalida um `Consome` de outra task: além do board, `SendMessage` para `main` com uma linha: `[T-NN] <fato> — ver /home/kaine/source/geduc-rag/.claude/tasks/kai-20260930-0848-remover-prisma-sem-orm/board.md`.
- Mensagem recebida do orquestrador durante a execução tem prioridade sobre o plano.

## Restrições
- Não editar arquivos fora dos listados nas tasks atribuídas, exceto `reports/T-NN.md` e o append em `board.md`.
- Commitar listando caminhos, com o trailer da task: `git add <caminhos>` seguido de `git commit -m "<assunto>" -m "Task: T-NN" -- <caminhos>` (só o `--` falha em arquivo novo sem add). Nunca `git add -A`, `git add .` nem `git commit -a`: a árvore é compartilhada com outros agentes da onda.
- Nunca `git checkout`, `git reset`, `git stash` nem `git restore` na árvore compartilhada — destroem ou escondem o trabalho alheio.
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
