# Levi — repositório SQL no padrão do projeto

subagent_type: general-purpose
model: inherit

## Contexto
Plano: módulo de calendário acadêmico no backend (escolas por tenant, calendário = ano letivo com dias tipados, visões e quantitativos). Implementa o acesso a `school` no padrão de `employees` para o service de escolas da Onda 3.

## Tasks atribuídas
- T-03: Repositório SQL de escolas

Leia a especificação completa de cada task (arquivos, Interface, critério de aceite, validação) na seção correspondente de `/home/kaine/source/geduc-rag/.claude/tasks/kai-20261001-1647-calendario-academico/tasks.md`. Não leia as demais seções.

## Caminhos relevantes
- `backend/src/modules/employees/application/interface/repository/employee.repository.interface.ts`
- `backend/src/modules/employees/infra/database/repositories/employee.repository.ts`
- `backend/src/modules/employees/infra/database/queries/employee-list.query.ts`
- `backend/src/modules/employees/__tests__/employee.repository.spec.ts` (`makeConnection`)
- `backend/src/@core/infra/database/query-builder/` (filters, paged-select)
- Board: `/home/kaine/source/geduc-rag/.claude/tasks/kai-20261001-1647-calendario-academico/board.md`
- Relatórios: `/home/kaine/source/geduc-rag/.claude/tasks/kai-20261001-1647-calendario-academico/reports/` (modelo em `_template.md`)
- Notas: `/home/kaine/source/geduc-rag/.claude/tasks/kai-20261001-1647-calendario-academico/notes.md` — leia § Decisões tomadas e § Descobertas antes de começar (rulings de ondas anteriores vivem ali, não no board).

## Ambiente
- Repositório único `/home/kaine/source/geduc-rag` (checkout compartilhado, sem worktree); commite com `git -C /home/kaine/source/geduc-rag`.
- Branch de trabalho `task/calendario-academico` (base `main`).
- Comandos rodam em `backend/` (`cd backend && ...`). Validação da task: os comandos do bloco Validação da sua seção em `tasks.md`. Baseline de `npx tsc --noEmit` e `npx eslint "{src,test}/**/*.ts"` vazio (ver `plan.md § Baseline`): qualquer linha de saída é regressão.
- Proibidos: `npm run lint` e `npm run format` (aplicam `--fix`/`prettier --write` no repositório inteiro); `eslint --fix` manual; ler ou imprimir `backend/.env`; `DROP`, `TRUNCATE`, `DELETE` sem `WHERE`; editar migration já aplicada (`0001`–`0003`); `git add -A`, `git add .`, `git commit -a`, `git checkout`, `git reset`, `git stash`, `git restore`; push; tocar as alterações não commitadas de `frontend/`.
- Hooks: `format-file.sh` roda `eslint --fix` em cada `.ts` editado (releia o arquivo antes de commitar); `protect-db.sh` pede confirmação para SQL destrutivo; `protect-migrations.sh` pede confirmação em `backend/database/migrations/**`; `check-complexity.sh` bloqueia no Stop acima do limite de complexidade ciclomática — mantenha funções curtas, com early return.
- nenhum pré-requisito externo (spec com conexão falsa)

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
cat >> "/home/kaine/source/geduc-rag/.claude/tasks/kai-20261001-1647-calendario-academico/board.md" <<'EOF'
- [T-NN] <fato>
EOF
```

- O que bloqueia você ou invalida um `Consome` de outra task: além do board, `SendMessage` para `main` com uma linha: `[T-NN] <fato> — ver /home/kaine/source/geduc-rag/.claude/tasks/kai-20261001-1647-calendario-academico/board.md`.
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
