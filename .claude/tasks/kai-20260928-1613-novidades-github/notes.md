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

## Bloqueios
- nenhum

## Descobertas
- nenhuma até o planejamento

## Pendências
- T-01: `GITHUB_BASE_BRANCH=` vazio passa em `@IsString()` sem `@MinLength(1)` nem default para `''` — backend/src/config/env.validation.ts:195
- T-03: resposta 2xx com corpo inválido (JSON malformado ou não-array) escapa como erro cru, não `GithubClientError` — backend/src/modules/changelog/github-pulls.client.ts:79
- T-03: ramo `AbortError` de `isAbort` sem teste (só `TimeoutError` exercitado) — backend/src/modules/changelog/github-pulls.client.ts:153
- T-03: mensagem de erro repete o status ("Status 401.") — backend/src/modules/changelog/github-pulls.client.ts:55-57,133
- T-03: `repo` entra na URL sem codificação/validação local, depende da validação da env em T-01 — backend/src/modules/changelog/github-pulls.client.ts:97

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
- Último status conhecido: Onda 1 concluída — T-01, T-02, T-03 [x], gate aprovado (jest backend 204/204, tsc/eslint ok), revisões rodada 1 sem bloqueantes.
- Próxima onda recomendada: Onda 2 — T-04, T-05, T-06 (T-06 depende só de T-02, já concluída)
