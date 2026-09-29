# Revisão final
Intervalo: 87b7179..bff9f84 (branch task/assistente-rag-ollama). 38 arquivos de código/docs, todos no Mapa de arquivos; nenhum em backend/prisma; nenhum `testWidgets`; `url_launcher` só em pubspec.yaml/lock (T-08). Cada arquivo de código foi tocado só pelo commit feat da própria task (sem commits de correção posteriores), então a triagem compara cada pendência com o estado final desses arquivos.
## Triagem
- [aberta] T-01: `GITHUB_BASE_BRANCH=` vazio passa em `@IsString()` → backend/src/config/env.validation.ts:145-146 (sem `@MinLength(1)`; mitigado por `.env.example` trazer `GITHUB_BASE_BRANCH=main` descomentado)
- [aberta] T-03: 2xx com corpo inválido escapa como erro cru → backend/src/modules/changelog/github-pulls.client.ts:618-619; somado ao relançamento de T-04 (changelog.service.ts:360, plano-mandou) vira 500 e não serve o cache `stale`, mas é cenário raro — segue sugestão
- [aberta] T-03: ramo `AbortError` de `isAbort` sem teste → github-pulls.client.ts:693; o spec só cria `TimeoutError` (github-pulls.client.spec.ts:193)
- [aberta] T-03: mensagem repete o status ("(401). Status 401.") → github-pulls.client.ts:675; não chega ao usuário (o service usa SOURCE_MESSAGES e o log só `reason`/`status`)
- [aberta] T-03: `repo` entra na URL sem codificação → github-pulls.client.ts:636; o `@Matches(/^[\w.-]+\/[\w.-]+$/)` aceita `../..`, que o fetch normaliza para outro path da API; valor vem só de env do admin
- [aberta] T-04: Review Focus de três chamadas simultâneas com cache VENCIDO sem teste; só cache vazio → changelog.service.spec.ts:173-185 (o código é o mesmo caminho `refresh`, service.ts:343-349)
- [aberta] T-04: `repository` sai com `trim()`, sem teste de `'  owner/nome  '` → changelog.service.ts:311
- [aberta] T-04: `logger.warn` real polui a saída do spec → changelog.service.ts:361
- [aberta] T-06: `ChangelogRepository.fetch` sem teste → frontend/lib/modules/changelog/data/changelog_repository.dart:16-20
- [aberta] T-06: `number` ausente vira `0` e `url` vira `''` → frontend/lib/modules/changelog/data/models/changelog_entry.dart:47-48; com T-08 o tile mostraria `#0` e abriria/copiaria link vazio, mas o contrato do backend sempre manda os dois
- [aberta] T-05: e2e só cobre `limit=0` → backend/test/app.e2e-spec.ts:270
- [aberta] T-05: `@ApiResponse` 502 sem schema de erro e sem 400/401 → backend/src/modules/changelog/changelog.controller.ts:212-217; os demais controllers (profiles/users) também só documentam o 200
- [aberta] T-07: sem teste de identidade de `Future` em `load()` concorrente → frontend/test/changelog/changelog_controller_test.dart:129-134
- [resolvida] T-07: `_fetch()` não limpa `_error` ao entrar em `loading` → a condição da pendência foi cumprida: página e card decidem pelo `state` (changelog_page.dart:24 `switch (_controller.state)`, changelog_recent_card.dart:54), e `error` só é lido no ramo `ChangelogViewState.error`
- [aberta] T-08: `Clipboard.setData` fora do `try` em `_openPr` → frontend/lib/modules/changelog/presentation/widgets/changelog_entry_tile.dart:31
- [aberta] T-08: fallback abrir/copiar sem teste automatizado → changelog_entry_tile.dart:20
- [aberta] T-08: `Tooltip` também com `compact: false` → frontend/lib/modules/changelog/presentation/widgets/changelog_type_badge.dart:58 (inofensivo em `ChangelogGroupSection`)
- [aberta] T-09: README não documenta o parâmetro `limit` → README.md:96 (`grep -n limit README.md` sem ocorrência na seção)
## Rulings
- plano · onda 0 — Sem branch nova: execução na branch atual `task/assistente-rag-ollama` (RAG ainda não mergeado); o BASE 87b7179 separa esta feature.
- plano · onda 0 — Sem worktree: checkout principal com isolamento `caminho exclusivo`.
- plano · onda 0 — API REST de pulls em vez da Search API; só a primeira página de 100 PRs fechados entra.
- plano · onda 0 — `GITHUB_REPO`/`GITHUB_TOKEN` vazios tratados após `trim()` no service e no client, porque `ConfigService.get` cai em `process.env` e devolve `''`.
- plano · onda 0 — `setup-e2e.ts` fixa `GITHUB_REPO=''` e o e2e sobrescreve `GithubPullsClient`: nenhum teste chama o GitHub.
- plano · onda 0 — Tipo do título sem diferenciar maiúsculas, normalizado em minúsculas; exige `: ` e descrição não vazia.
- plano · onda 0 — `url_launcher` aprovado pelo usuário (T-08), com cópia do link + toast como fallback.
- plano · onda 0 — Card "Novidades recentes" (T-11) dividindo o `ChangelogController` singleton do shell com `ensureLoaded()`.
- plano · onda 0 — T-11 sem teste de widget (GoogleFonts faz `rethrow` sem rede em `flutter test`).
- plano · onda 1 — `repos.py --preparar` recusou por branch não declarada; ignorado porque o checkout já estava na branch pedida.
- T-02 · onda 1 — Trailer `Task: T-02 (RED)` de a1aa4b6 em parágrafo separado; aceito sem reescrever histórico.
- T-04 · onda 2 — Payload não configurado montado localmente no service e `import type` no DTO por TS1272; desvios aceitos.
- T-05 · onda 3 — Commit RED 91a81e0 tocou também `backend/test/setup-e2e.ts`; aceito (arquivo em "Arquivos prováveis" e necessário para o RED rodar).
- T-08 · onda 4 — `url_launcher` adicionado com aprovação; página e tile sem teste de widget pela limitação do GoogleFonts.
- T-11 · onda 5 — `sem teste` por plano, sem commit RED; aceito.
- T-10 · onda 6 — QA read-only aprovada: jest 220/220, e2e 16/16, tsc/eslint exit 0, flutter analyze limpo, flutter test 64/64, sem diff em backend/prisma.
## Achados
- [sugestão] Com cache vencido e GitHub falhando, cada requisição volta a chamar o GitHub (a deduplicação só cobre chamadas simultâneas e não há backoff após falha); sem token, isso gasta o limite de 60 req/h enquanto o GitHub estiver instável → backend/src/modules/changelog/changelog.service.ts:329-336
