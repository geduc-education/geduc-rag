# Notas de execução

## Decisões tomadas
- 2026-09-28 · plano · onda 0 — Sem branch nova, por decisão do usuário: a execução é na branch atual `task/assistente-rag-ollama`, que contém o RAG ainda não mergeado em `main` (HEAD 87b7179 no planejamento). Os commits desta feature ficam na mesma branch do RAG; o BASE da onda 1 separa o que é desta feature.
- 2026-09-28 · plano · onda 0 — Sem worktree, por decisão do usuário: execução no checkout principal `/home/kaine/source/geduc-rag` com isolamento `caminho exclusivo`.
- 2026-09-28 · plano · onda 0 — API REST de pulls (`state=closed&base=<branch>&sort=updated&direction=desc&per_page=100`) em vez da Search API: limite de 10 req/min sem token na Search, atraso de indexação e payload diferente. Limitação aceita: só a primeira página de 100 PRs fechados entra; PRs fechados sem merge e fora do padrão ocupam vagas nessa página.
- 2026-09-28 · plano · onda 0 — `GITHUB_REPO=''`/`GITHUB_TOKEN=''` viram `undefined` na validação, mas o `ConfigService.get` cai em `process.env` e devolve `''`: o service trata vazio após `trim()` como não configurado e o client só manda `Authorization` com token não vazio.
- 2026-09-28 · plano · onda 0 — `backend/.env` existe e o `ConfigModule` o carrega no e2e; `setup-e2e.ts` fixa `GITHUB_REPO=''` (o `process.env` vence o `.env`) e o e2e sobrescreve `GithubPullsClient`, então nenhum teste chama o GitHub.
- 2026-09-28 · plano · onda 0 — O tipo do título é aceito sem diferenciar maiúsculas (`Feat:` conta) e normalizado em minúsculas; exige `: ` (dois-pontos e espaço) e descrição não vazia.
- 2026-09-28 · plano · onda 0 — `url_launcher` aprovado pelo usuário: T-08 roda `fvm flutter pub add url_launcher` (rede; altera `pubspec.yaml`/`pubspec.lock`, dono único) e o `#número` abre o PR numa aba nova; se `launchUrl` falhar, o link é copiado (`Clipboard.setData` + `showAppToast`).
- 2026-09-28 · plano · onda 0 — Revisão pedida pelo usuário: card "Novidades recentes" na tela de início (T-11). Card e página usam o mesmo `ChangelogController` singleton do shell; `ensureLoaded()` busca só na primeira vez da sessão (e depois de erro) e compartilha a busca em andamento, então as duas telas fazem uma chamada à API. `load()` é a atualização forçada.
- 2026-09-28 · plano · onda 0 — T-11 sem teste de widget: `context.textStyles` usa `GoogleFonts`, que faz `rethrow` quando não baixa a fonte em `flutter test` (`google_fonts-8.2.1`), e o projeto não tem `testWidgets`. A lógica do card está no controller (T-07) e o card é verificado por `analyze`, `build web` e `grep`.
- 2026-09-28 · plano · onda 1 — Execução na branch atual `task/assistente-rag-ollama`, sem criar `task/novidades-github` (decisão do usuário); `repos.py --preparar` recusou com "branch de trabalho não declarada no plano", ignorado por ruling já que o passo só cria/retoma branch e o checkout já estava na branch pedida.
- 2026-09-28 · T-02 · onda 1 — Trailer `Task: T-02 (RED)` do commit a1aa4b6 ficou em parágrafo separado do corpo; o validador confirmou que o grep o identifica como RED (mensagem completa, não só trailers) — aceito sem reescrever histórico.
- 2026-09-28 · T-04 · onda 2 — Payload "não configurado" montado localmente no service (T-02 não exporta a constante) e `import type` no DTO por TS1272 — desvios aceitos.
- 2026-09-28 · T-05 · onda 3 — RED inválido rejeitado: commit RED 91a81e0 também tocou `backend/test/setup-e2e.ts`, fora das crases do bloco Teste RED; aceito porque o arquivo está em "Arquivos prováveis", a Interface descreve a mudança (`GITHUB_REPO=''`) e ela é necessária para o RED rodar.
- 2026-09-28 · T-08 · onda 4 — `url_launcher` adicionado com aprovação do usuário; página e tile sem teste de widget pela limitação do GoogleFonts em flutter test (mesma do T-11, já registrada em notes.md) — aceito.

## Bloqueios
- nenhum

## Descobertas
- `registerChangelogBinds`/`registerChangelogRoutes` registrados em home_module.dart; `ChangelogController` é lazy singleton do shell (T-11 usa `inject<ChangelogController>()`); `ChangelogTypeBadge`, `changelogTypeIcons` e `changelogTypeShortLabels` em `frontend/lib/modules/changelog/presentation/widgets/changelog_type_badge.dart`; `ChangelogEntryTile` em `widgets/changelog_entry_tile.dart`. Commits 076d9b1 (RED), 883dbd1.

## Pendências
- T-01: `GITHUB_BASE_BRANCH=` vazio passa em `@IsString()` sem `@MinLength(1)` nem default para `''` — backend/src/config/env.validation.ts:195
- T-03: resposta 2xx com corpo inválido (JSON malformado ou não-array) escapa como erro cru, não `GithubClientError` — backend/src/modules/changelog/github-pulls.client.ts:79
- T-03: ramo `AbortError` de `isAbort` sem teste (só `TimeoutError` exercitado) — backend/src/modules/changelog/github-pulls.client.ts:153
- T-03: mensagem de erro repete o status ("Status 401.") — backend/src/modules/changelog/github-pulls.client.ts:55-57,133
- T-03: `repo` entra na URL sem codificação/validação local, depende da validação da env em T-01 — backend/src/modules/changelog/github-pulls.client.ts:97
- T-04: Review Focus pede três requisições simultâneas com cache vencido → uma chamada; o spec só cobre cache vazio — backend/src/modules/changelog/__tests__/changelog.service.spec.ts:173
- T-04: `repository` devolve `GITHUB_REPO` após `trim()`, não o valor bruto como diz a Interface; nenhum teste cobre `'  owner/nome  '` — backend/src/modules/changelog/changelog.service.ts:54
- T-04: `logger.warn` real polui a saída do spec nos casos de erro; considerar `jest.spyOn(Logger.prototype, 'warn')` — backend/src/modules/changelog/changelog.service.ts:104
- T-06: `ChangelogRepository.fetch` não tem teste (path e `queryParameters` só conferidos por leitura) — frontend/lib/modules/changelog/data/changelog_repository.dart:16-20
- T-06: `number` ausente no JSON vira `0` silenciosamente e `url` vira `''`; considerar descartar o item em `tryFromJson` — frontend/lib/modules/changelog/data/models/changelog_entry.dart:47-48
- T-05: o e2e só cobre `limit=0`; `limit=101`, `limit=abc` e o default 50 repassado ao service não têm caso — backend/test/app.e2e-spec.ts:270
- T-05: o `@ApiResponse` 502 não referencia o schema de erro padrão e não há `@ApiResponse` 400/401 documentados — backend/src/modules/changelog/changelog.controller.ts:20
- T-07: `load()` concorrente não tem teste de identidade de `Future` (`identical(c.load(), c.load())`), só `fake.calls.length == 1` — frontend/test/changelog/changelog_controller_test.dart:129
- T-07: `_fetch()` não limpa `_error` ao entrar em `loading`; UI de T-08/T-11 deve decidir pelo `state`, nunca por `error != null` — frontend/lib/modules/changelog/presentation/changelog_controller.dart:66
- T-08: em `_openPr`, `Clipboard.setData` fica fora do `try`: falha de escrita no clipboard na web escapa sem tratamento e o toast não aparece — frontend/lib/modules/changelog/presentation/widgets/changelog_entry_tile.dart:31
- T-08: fallback abrir/copiar sem teste automatizado; extrair a decisão para função com `launchUrl` injetável permitiria testá-la sem `testWidgets`/GoogleFonts — frontend/lib/modules/changelog/presentation/widgets/changelog_entry_tile.dart:20
- T-08: `Tooltip` envolve o selo também com `compact: false`, quando o rótulo já está visível; o contrato só pede tooltip no modo compacto — frontend/lib/modules/changelog/presentation/widgets/changelog_type_badge.dart:58
- T-09: README documenta `GET /changelog` mas não o parâmetro `limit` (1..100, default 50) — README.md:96

## Riscos
- A árvore tem alterações não commitadas do plano anterior (`.claude/tasks/kai-20260925-0848-assistente-rag-ollama/board.md`, `reports/T-18.md`): os agentes commitam só os próprios caminhos e não as tocam.
- Rate limit de 60 req/h sem token: mitigado pelo cache TTL (default 600 s), pela deduplicação de chamadas simultâneas e pelo `stale` quando o GitHub falha.
- `fvm flutter pub add url_launcher` sem rede falha: T-08 relata em Pendências sem contornar.
- Hook `check-complexity.sh` pode bloquear `ChangelogService.list` e o mapeamento de erros do client: quebrar em funções pequenas (mensagem por `reason` em mapa constante).
- O cache vive na memória do processo: várias instâncias do backend fazem uma chamada cada.

## Retomada
- Pasta: `.claude/tasks/kai-20260928-1613-novidades-github/`
- Sessões: 620961c4-2eeb-49ef-98ff-082b2a5126c3
- Branch de trabalho: task/assistente-rag-ollama (base: task/assistente-rag-ollama)
- BASE da onda 1: 87b7179
- Commits por onda:
  - Onda 1: BASE 87b7179 → HEAD 61ce830 (a1aa4b6, c844b1a, 8429e72, 492a2aa, 7cd32bb, 8e3a7e1, 82fb1d5, b43ec17, 61ce830)
  - Onda 2: BASE cf56286 → HEAD f4f08fa (bbb8756, b996f9c, 052f03f, ec8287c, f4f08fa)
  - Onda 3: BASE 99f1a22 → HEAD 0de5dbb (91a81e0, 1d14ef5, 8328221, 0de5dbb)
  - Onda 4: BASE 3e91188 → HEAD 883dbd1 (076d9b1, 883dbd1, 3061bb6)
- Último status conhecido: Onda 4 concluída — T-08, T-09 [x], gate aprovado (flutter test 64/64, analyze limpo, build web ok, navigation test prova "Novidades" sem permissão, README com as 5 envs e sem token), RED de T-08 válido, revisões rodada 1 aprovadas com sugestões, sem bloqueantes.
- Próxima onda recomendada: Onda 5 — T-11 (depende de T-08, já concluída; não paralelizável)
