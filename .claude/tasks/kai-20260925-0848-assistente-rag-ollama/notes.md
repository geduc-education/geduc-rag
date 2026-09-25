# Notas de execução

## Decisões tomadas
- 2026-09-25 · plano · onda 0 — O embedding é gravado em `Bytes @db.Blob` (Float32 little-endian) em vez de JSON. Com 384 dims, são 1.536 bytes por chunk, contra cerca de 7–8 KB em JSON, e a decodificação é direta (`new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)`), sem `JSON.parse` por linha a cada busca. O Prisma 7 expõe `Bytes` como `Uint8Array`.
- 2026-09-25 · plano · onda 0 — A busca vetorial é uma varredura linear dos chunks do tenant (`tenantId` + documento `ready`), com cosseno no Node e descarte de `dimensions` diferente. É suficiente para dezenas de milhares de chunks por tenant. Um índice externo fica para quando o volume exigir.
- 2026-09-25 · plano · onda 0 — `RAG_STORAGE=mysql|memory` mantém os adapters in-memory vivos para o e2e (que stuba o Prisma) e para dev sem banco. Os repositórios Prisma são testados por spec unitário com `PrismaService` mockado.
- 2026-09-25 · plano · onda 0 — A extração de texto é síncrona no request de upload. Formato inválido e PDF sem texto respondem 400 na hora (`UNSUPPORTED_DOCUMENT_TYPE`, `DOCUMENT_TEXT_EMPTY`), e a ingestão continua recebendo texto via `Document.content`.
- 2026-09-25 · plano · onda 0 — O `filename` das citações vem de um join `document_chunk → document` na busca, e não de uma coluna denormalizada. `VectorStoreRecord.filename` só é usado pelo adapter in-memory.
- 2026-09-25 · plano · onda 0 — A conversa passa a pertencer a (tenant, usuário). Um `conversationId` alheio ou inexistente responde 404 (T-05); a alternativa de criar uma conversa com esse id colidiria com a PK de outro usuário (500).
- 2026-09-25 · plano · onda 0 — As mensagens são persistidas em append-only: `save` insere só as mensagens além das já gravadas, dentro de `$transaction` (T-10).
- 2026-09-25 · plano · onda 0 — Os prefixos do e5 (`query: `/`passage: `) entram via `EmbeddingKind`, sem heurística por nome de modelo, e ficam configuráveis por env para quem trocar de modelo.
- 2026-09-25 · plano · onda 0 — O transformers.js é carregado lazy com `import()` dinâmico (o tsconfig usa `module: nodenext`, que preserva o `import()` em CJS) e com um loader injetável, para que o jest nunca importe o pacote ESM. O boot não baixa o modelo.
- 2026-09-25 · plano · onda 0 — O Ollama é chamado via `fetch` nativo em `/api/generate` com `options.num_ctx = LLM_CONTEXT_WINDOW_TOKENS`. Sem isso, o Ollama usa o contexto padrão dele e trunca o prompt do RAG em silêncio. `stream: false`. O prompt atual (`rag-answer.prompt.ts`) é mantido.
- 2026-09-25 · plano · onda 0 — Os defaults do código continuam `mock` (embedding, LLM) para testes e CI. O `.env.example` (T-17) sugere `local`/`ollama`/`mysql`, e o dev ajusta o próprio `.env`.
- 2026-09-25 · plano · onda 0 — A migration é gerada sem `migrate dev`, que pode propor um reset em caso de drift, via `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > prisma/migrations/20260925000000_rag_persistence/migration.sql` (flags do Prisma 7; confira em `npx prisma migrate diff --help`), e é aplicada com `npx prisma migrate deploy`. O SQL é escrito pelo redirecionamento do shell, sem Edit/Write na pasta de migrations.
- 2026-09-25 · plano · onda 0 — Frontend: cada tela tem o próprio `*_binds.dart`, criado como stub em T-06, para que T-15 e T-16 rodem em paralelo sem disputar `rag_assistant_module.dart`. O `RagViewState` é local ao módulo, porque o `ViewState` de `users` não é compartilhado.

## Bloqueios
- O repositório não tem nenhum commit (branch `main` sem HEAD). A branch `task/assistente-rag-ollama` e o BASE da onda 1 exigem um commit inicial em `main` antes da Fase 4. Desbloqueio: o usuário autoriza o commit inicial da árvore atual (respeitando o `.gitignore`).

## Descobertas
- O `all-exceptions.filter.ts` já traduz `MulterError LIMIT_FILE_SIZE` para 413 `ATTACHMENT_TOO_LARGE`, mas o código não existe em `error-codes.ts`, e o comentário cita um `AttachmentTooLargeInterceptor` inexistente. O T-02 cria o código.
- `.gitignore` não ignora `.claude/tasks/`, então os arquivos do plano entram nos commits `chore(tasks)`.
- A descrição do `backend/package.json` diz PostgreSQL; o T-02 corrige para MySQL.
- `EMBEDDING_PROVIDER`/`LLM_PROVIDER` existiam no env (`@IsIn(['mock'])`), mas nenhum código lia essas variáveis.

## Pendências
- nenhuma

## Riscos
- `@huggingface/transformers` baixa binários do `onnxruntime-node` no `npm install` (T-02) e o modelo (cerca de 120 MB) na primeira inferência. Mitigação: o loader é lazy e injetável, os testes usam fake e o `EMBEDDING_CACHE_DIR` é configurável. O T-18 exige rede na primeira execução.
- O `pdf-parse` v2 pode ser só ESM ou depender do `pdfjs-dist`. Se o `require` falhar no jest, o T-09 usa `import()` dinâmico ou `unpdf` e registra a troca no board.
- A fila in-memory perde jobs num restart, e o documento fica em `pending`/`processing` indefinidamente (fora do escopo). Mitigação futura: reprocessar os `pending` no boot.
- A varredura linear dos chunks cresce O(n) por tenant, e a latência da busca aumenta com milhares de documentos. Mitigação: `@@index([tenantId, dimensions])` e o filtro `ready`; o índice vetorial fica como evolução.
- Com 8 GB de VRAM, o `qwen2.5:7b` Q4 (cerca de 4,7 GB) cabe, mas um `num_ctx` alto aumenta o KV cache. O default de `LLM_CONTEXT_WINDOW_TOKENS=8192` é seguro, e o T-17 documenta o ajuste.
- Os hooks `format-file.sh` (`eslint --fix`/`dart format` a cada Edit/Write) e `check-complexity.sh` (Stop) podem alterar ou bloquear arquivos. Os agentes não os contornam.
- Trocar `EMBEDDING_PROVIDER` de `mock` para `local` com a mesma dimensão (384) mistura vetores incompatíveis de mesmo tamanho. Mitigação: o T-17 documenta que é preciso reenviar os documentos ao trocar de provider ou de modelo.

## Retomada
- Pasta: `.claude/tasks/kai-20260925-0848-assistente-rag-ollama/`
- Sessões: 620961c4-2eeb-49ef-98ff-082b2a5126c3
- Branch de trabalho: task/assistente-rag-ollama (base: main)
- BASE da onda 1: {hash7}
- Commits por onda: {Onda N: BASE <hash7> → HEAD <hash7> (<hashes dos commits>)}
- Último status conhecido: {resumo}
- Próxima onda recomendada: {onda}
