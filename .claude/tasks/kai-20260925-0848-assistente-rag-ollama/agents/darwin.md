# Darwin — persistência e API de documentos

subagent_type: general-purpose
model: inherit

## Contexto
Migra o pipeline RAG dos adapters in-memory para o MySQL via Prisma: cria o schema e a migration, o repositório Prisma de documentos e a API de documentos (upload multipart, listagem, exclusão). Existe porque schema, repositório e API de documentos compartilham o mesmo modelo de dados.

## Tasks atribuídas
- T-01: schema Prisma e migration rag_persistence (onda 1)
- T-08: repositório Prisma de documentos e motivo de falha (onda 2)
- T-14: API de documentos, upload multipart, listagem, exclusão e e2e (onda 3)

Leia a especificação completa de cada task (arquivos, Interface, critério de aceite, validação) na seção correspondente de `/home/kaine/source/geduc-rag/.claude/tasks/kai-20260925-0848-assistente-rag-ollama/tasks.md`. Não leia as demais seções.

## Caminhos relevantes
- `backend/prisma/schema.prisma` e `backend/prisma/migrations/`
- `backend/src/modules/documents/` e `backend/src/modules/ingestion/`
- `backend/src/database/prisma.service.ts` (PrismaService global)
- `backend/src/common/filters/all-exceptions.filter.ts` (MulterError → 413)
- `backend/test/app.e2e-spec.ts` e `backend/test/setup-e2e.ts`
- Board: `/home/kaine/source/geduc-rag/.claude/tasks/kai-20260925-0848-assistente-rag-ollama/board.md`
- Relatórios: `/home/kaine/source/geduc-rag/.claude/tasks/kai-20260925-0848-assistente-rag-ollama/reports/` (modelo em `_template.md`)
- Notas: `/home/kaine/source/geduc-rag/.claude/tasks/kai-20260925-0848-assistente-rag-ollama/notes.md` — leia § Decisões tomadas e § Descobertas antes de começar (rulings de ondas anteriores vivem ali, não no board).

## Ambiente
- Repositório único `/home/kaine/source/geduc-rag` (raiz do projeto); commite com `git -C /home/kaine/source/geduc-rag`.
- Branch `task/assistente-rag-ollama`.
- Validação backend (rode de `/home/kaine/source/geduc-rag`): `(cd backend && npx jest <spec da task>)`, `(cd backend && npx tsc --noEmit)` e `(cd backend && npx eslint "{src,test}/**/*.ts")` sem `--fix`. Baseline limpo: exit 0 é o critério (`/home/kaine/source/geduc-rag/.claude/tasks/kai-20260925-0848-assistente-rag-ollama/baseline/`).
- T-01: pré-requisito é o MySQL de dev no ar (`docker compose -f infra/db/docker-compose.yml ps` mostra `mysql` em `running`; se não estiver, relate em Pendências e não suba serviços). Confirme o datasource em `localhost:3307` pela saída de `npx prisma migrate status`, sem ler `.env`. Se `migrate status` apontar drift ou a `init` pendente, pare e relate. Gere a migration com `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` redirecionado para o arquivo (ver `notes.md § Decisões`), aplique com `npx prisma migrate deploy` e rode `npx prisma generate` em seguida.
- T-14: `npm run test:e2e` roda sem banco (`RAG_STORAGE=memory` em `setup-e2e.ts`).
- Proibidos: `npm run lint` e `npm run format` (aplicam `--fix`/`--write` na árvore inteira); `npx prisma migrate reset`, `migrate dev`, `db push` e qualquer DROP/TRUNCATE/DELETE sem WHERE; ler ou imprimir `.env`; `npm install`/`npm uninstall` (só o T-02 altera `package.json`/`package-lock.json`); `npx prisma generate` fora do T-01; `git add -A`/`.`, `git commit -a`, `git stash`/`checkout`/`reset`/`restore`. Exceção: T-01 pode rodar `npx prisma generate`, `migrate diff` e `migrate deploy`.
- Avisos de hook: `format-file.sh` roda `eslint --fix` (arquivos `.ts` do backend) ou `fvm dart format` (`.dart`) depois de cada Edit/Write, o que é esperado e deve ser incluído no commit; `check-complexity.sh` (Stop) bloqueia função acima do limite de complexidade: quebre a função em vez de contornar; `protect-migrations.sh` pede confirmação em Edit/Write dentro de `backend/prisma/migrations/`; `protect-db.sh` nega ou pede confirmação em comandos destrutivos.

Commite com `git -C <caminho acima>` em cada repositório que a task toca. Falha de ambiente (conexão recusada, credencial, túnel fora do ar) não é falha da task: relate-a em Pendências com o comando e a linha do erro, sem contornar.

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
cat >> "/home/kaine/source/geduc-rag/.claude/tasks/kai-20260925-0848-assistente-rag-ollama/board.md" <<'EOF'
- [T-NN] <fato>
EOF
```

- O que bloqueia você ou invalida um `Consome` de outra task: além do board, `SendMessage` para `main` com uma linha: `[T-NN] <fato> — ver /home/kaine/source/geduc-rag/.claude/tasks/kai-20260925-0848-assistente-rag-ollama/board.md`.
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
