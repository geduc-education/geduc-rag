# Tasks

| ID | Camada | Descrição | Dependências | Paralelizável | Complexidade | Agente | Status |
|---|---|---|---|---|---|---|---|
| T-01 | backend | Envs do GitHub/cache validadas, código de erro 502 e `.env.example` | — | sim | simples | Levi | [x] |
| T-02 | backend | Contrato do changelog (tipos + payload) e parser de título Conventional Commits | — | sim | média | Platão | [x] |
| T-03 | backend | `GithubPullsClient`: PRs mergeados via REST, timeout e erros tipados sem vazar token | — | sim | média | Naruto | [x] |
| T-04 | backend | `ChangelogService`: não configurado, cache TTL, stale e 502 + DTOs de resposta | T-01, T-02, T-03 | sim | alta | Saitama | [x] |
| T-05 | backend | `GET /changelog`: controller, query DTO, módulo, registro no AppModule e e2e | T-04 | sim | média | Aang | [x] |
| T-06 | frontend | Models `ChangelogFeed`/`ChangelogEntry`, repository e fake de teste | T-02 | sim | simples | Arquimedes | [x] |
| T-07 | frontend | `ChangelogController`: estados, agrupamento, recentes e cache de sessão | T-06 | sim | média | Spock | [x] |
| T-08 | frontend | Página Novidades, módulo, rota `/home/changelog`, item de menu, selo de tipo e `url_launcher` | T-07 | sim | média | Tesla | [x] |
| T-09 | docs | README e `backend/CLAUDE.md`: configuração do GitHub e módulo `changelog` | T-01, T-05 | sim | simples | Gandalf | [x] |
| T-11 | frontend | Card "Novidades recentes" na tela de início | T-08 | não | média | Athena | [x] |
| T-10 | qa | Validação integral backend + frontend na branch | T-08, T-09, T-11 | não | simples | Sherlock | [ ] |

## Detalhamento

### T-01 — Envs do GitHub/cache validadas, código de erro 502 e `.env.example`

**Camada:** backend
**Dependências:** nenhuma
**Paralelizável:** sim
**Complexidade:** simples
**Agente:** Levi

**Arquivos prováveis**
- `backend/src/config/env.validation.ts`
- `backend/src/config/__tests__/env.validation.spec.ts`
- `backend/src/common/errors/error-codes.ts`
- `backend/.env.example`

**Interface**
- Produz: envs em `EnvironmentVariables` (seção `// --- Changelog (GitHub) ---`): `GITHUB_REPO?: string` (`@Transform` que converte `''` em `undefined`, `@IsOptional()`, `@Matches(/^[\w.-]+\/[\w.-]+$/)`), `GITHUB_TOKEN?: string` (`''` vira `undefined`, `@IsOptional() @IsString()`), `GITHUB_BASE_BRANCH: string = 'main'`, `GITHUB_TIMEOUT_MS: number = 5000` (`@Type(() => Number) @IsInt() @Min(1)`), `CHANGELOG_CACHE_TTL_SECONDS: number = 600` (`@Type(() => Number) @IsInt() @Min(0)`; 0 = sem cache). Código `ERROR_CODES.CHANGELOG_SOURCE_UNAVAILABLE` (valor `'CHANGELOG_SOURCE_UNAVAILABLE'`, JSDoc `502`, grupo `// --- Changelog ---`).
- Consome: nada

**Teste RED**
- `backend/src/config/__tests__/env.validation.spec.ts` — sem as envs, `validateEnv({ ...BASE })` devolve `GITHUB_BASE_BRANCH === 'main'`, `GITHUB_TIMEOUT_MS === 5000`, `CHANGELOG_CACHE_TTL_SECONDS === 600` e `GITHUB_REPO === undefined`; `GITHUB_REPO: ''` também resulta em `undefined` sem lançar; `GITHUB_REPO: 'sem-barra'` lança erro que casa `/GITHUB_REPO/`; `CHANGELOG_CACHE_TTL_SECONDS: '-1'` lança `/CHANGELOG_CACHE_TTL_SECONDS/` (comando: `cd backend && npx jest src/config/__tests__/env.validation.spec.ts`)

**Critério de aceite**
- `npx jest src/config/__tests__/env.validation.spec.ts` imprime `Tests:` sem `failed`, com os casos novos listados.
- `backend/.env.example` tem a seção `# --- Changelog (GitHub) ---` com `# GITHUB_REPO=owner/nome`, `# GITHUB_TOKEN=`, `GITHUB_BASE_BRANCH=main`, `GITHUB_TIMEOUT_MS=5000` e `CHANGELOG_CACHE_TTL_SECONDS=600`, sem valor real de token.
- `grep -c CHANGELOG_SOURCE_UNAVAILABLE backend/src/common/errors/error-codes.ts` imprime `1`.

**Validação**
- `(cd backend && npx jest src/config/__tests__/env.validation.spec.ts)` (evidência: linha `Tests:` sem `failed`)
- `(cd backend && npx tsc --noEmit && npx eslint "{src,test}/**/*.ts")` (evidência: exit 0 e nenhuma linha nova em relação a `baseline/backend-tsc.txt` e `baseline/backend-eslint.txt`, ambos vazios)
- `grep -n "GITHUB_\|CHANGELOG_CACHE" backend/.env.example` (evidência: as cinco envs, `GITHUB_REPO` e `GITHUB_TOKEN` comentadas)
- Review Focus: caso `GITHUB_REPO: ''` e `GITHUB_TOKEN: ''` no mesmo spec (evidência: `validateEnv` não lança e os dois ficam `undefined`)

### T-02 — Contrato do changelog (tipos + payload) e parser de título Conventional Commits

**Camada:** backend
**Dependências:** nenhuma
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Platão

**Arquivos prováveis**
- `backend/src/modules/changelog/changelog.types.ts`
- `backend/src/modules/changelog/changelog-title.parser.ts`
- `backend/src/modules/changelog/__tests__/changelog-title.parser.spec.ts`

**Interface**
- Produz: em `changelog.types.ts`: `export type ChangelogType = 'feat' | 'fix' | 'refactor'`, `export interface ParsedTitle { type: ChangelogType; scope: string | null; breaking: boolean; description: string }`, `export interface ChangelogItem { type: ChangelogType; scope: string | null; breaking: boolean; title: string; number: number; url: string; mergedAt: string }`, `export interface ChangelogFeed { configured: boolean; repository: string | null; items: ChangelogItem[]; fetchedAt: string | null; stale: boolean }`. Em `changelog-title.parser.ts`: `export function parseConventionalTitle(title: string): ParsedTitle | null`.
- Produz (payload de `GET /changelog`, 200 configurado): `{"configured":true,"repository":"owner/nome","items":[{"type":"feat","scope":"chat","breaking":false,"title":"cita trechos","number":42,"url":"https://github.com/owner/nome/pull/42","mergedAt":"2026-09-20T12:00:00Z"}],"fetchedAt":"2026-09-28T16:00:00.000Z","stale":false}`; 200 não configurado: `{"configured":false,"repository":null,"items":[],"fetchedAt":null,"stale":false}`; 502: `{"statusCode":502,"code":"CHANGELOG_SOURCE_UNAVAILABLE","message":"..."}`. `items` vem ordenado por `mergedAt` decrescente; `mergedAt` e `fetchedAt` em ISO 8601.
- Regra do parser: `title.trim()` casa `/^(feat|fix|refactor)(?:\(([^()]*\S[^()]*)\))?(!)?:\s+(\S.*)$/i`; `type` sai em minúsculas, `scope` e `description` com `trim()`; qualquer outro tipo, `feat(): x`, `feat:x` (sem espaço) ou descrição vazia → `null`.
- Consome: nada

**Teste RED**
- `backend/src/modules/changelog/__tests__/changelog-title.parser.spec.ts` — `parseConventionalTitle('feat(chat): cita trechos')` devolve `{ type: 'feat', scope: 'chat', breaking: false, description: 'cita trechos' }`; `'fix!: corrige login'` devolve `breaking: true, scope: null`; `'refactor(api)!: extrai client'` devolve `type: 'refactor', scope: 'api', breaking: true`; `'Feat: novo menu'` devolve `type: 'feat'`; `'chore: bump'`, `'docs(readme): ajuste'`, `"Merge branch 'main'"`, `'feat:sem espaço'`, `'feat(): vazio'` e `'feat: '` devolvem `null` (comando: `cd backend && npx jest src/modules/changelog/__tests__/changelog-title.parser.spec.ts`)

**Critério de aceite**
- O spec do parser imprime `Tests:` com todos os casos acima `passed` e nenhum `failed`.
- `changelog.types.ts` exporta exatamente `ChangelogType`, `ParsedTitle`, `ChangelogItem` e `ChangelogFeed` com os campos da Interface (`grep -c "export" backend/src/modules/changelog/changelog.types.ts` imprime `4`).

**Validação**
- `(cd backend && npx jest src/modules/changelog/__tests__/changelog-title.parser.spec.ts)` (evidência: `Tests:` sem `failed`)
- `(cd backend && npx tsc --noEmit && npx eslint "src/modules/changelog/**/*.ts")` (evidência: exit 0; nenhuma linha nova em relação a `baseline/backend-tsc.txt` e `baseline/backend-eslint.txt`)
- Review Focus: casos `'  feat(Chat):  Novo menu  '` → `{ type: 'feat', scope: 'Chat', breaking: false, description: 'Novo menu' }` e `'FIX: x'` → `type: 'fix'` no mesmo spec (evidência: `passed`)

### T-03 — `GithubPullsClient`: PRs mergeados via REST, timeout e erros tipados sem vazar token

**Camada:** backend
**Dependências:** nenhuma
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Naruto

**Arquivos prováveis**
- `backend/src/modules/changelog/github-pulls.client.ts`
- `backend/src/modules/changelog/__tests__/github-pulls.client.spec.ts`

**Interface**
- Produz: `export const GITHUB_API_URL = 'https://api.github.com'`, `export interface GithubClientOptions { baseBranch: string; token?: string; timeoutMs: number }`, `export interface GithubMergedPull { number: number; title: string; url: string; mergedAt: string }`, `export type GithubErrorReason = 'timeout' | 'network' | 'unauthorized' | 'forbidden' | 'not_found' | 'rate_limited' | 'http_error'`, `export class GithubClientError extends Error { constructor(reason: GithubErrorReason, status: number | null, message: string); readonly reason: GithubErrorReason; readonly status: number | null }`, `export class GithubPullsClient { constructor(options: GithubClientOptions, fetchFn: typeof fetch = globalThis.fetch); listMergedPulls(repo: string): Promise<GithubMergedPull[]> }` (sem `@Injectable()`: é instanciado por factory no módulo, T-05).
- Requisição: `GET ${GITHUB_API_URL}/repos/${repo}/pulls?state=closed&base=<encodeURIComponent(baseBranch)>&sort=updated&direction=desc&per_page=100`, headers `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`, `User-Agent: geduc-rag`, e `Authorization: Bearer <token>` só quando `token` não é vazio; `signal: AbortSignal.timeout(timeoutMs)`. Resposta: descarta PR com `merged_at === null`; mapeia `number`, `title`, `html_url` → `url`, `merged_at` → `mergedAt`.
- Erros: 401 → `unauthorized`; 403 ou 429 com header `x-ratelimit-remaining: 0`, ou 429 → `rate_limited`; outro 403 → `forbidden`; 404 → `not_found`; outro não-2xx → `http_error`; abort por timeout (`TimeoutError`/`AbortError`) → `timeout` com `status: null`; outra exceção do `fetch` → `network` com `status: null`. A `message` nunca contém o token.
- Consome: nada

**Teste RED**
- `backend/src/modules/changelog/__tests__/github-pulls.client.spec.ts` — com `fetchFn` = `jest.fn()` devolvendo `new Response(...)`: a URL chamada é `https://api.github.com/repos/owner/nome/pulls?state=closed&base=main&sort=updated&direction=desc&per_page=100`; com `token: 'ghp_secreto'` o header `Authorization` é `Bearer ghp_secreto` e sem token o header não existe; de dois PRs (um com `merged_at: null`) sai só o mergeado, com `url` igual ao `html_url`; 401 rejeita com `GithubClientError` `reason: 'unauthorized'`, 403 com `x-ratelimit-remaining: 0` com `reason: 'rate_limited'`, 404 com `reason: 'not_found'`, `fetchFn` que lança `TypeError('fetch failed')` com `reason: 'network'` (comando: `cd backend && npx jest src/modules/changelog/__tests__/github-pulls.client.spec.ts`)

**Critério de aceite**
- O spec do client imprime `Tests:` sem `failed`, cobrindo URL, header com e sem token, filtro de `merged_at` e os quatro motivos de erro do RED.
- Nenhuma chamada de rede real: `fetchFn` é sempre o mock do spec (`grep -c "globalThis.fetch" backend/src/modules/changelog/__tests__/github-pulls.client.spec.ts` imprime `0`).

**Validação**
- `(cd backend && npx jest src/modules/changelog/__tests__/github-pulls.client.spec.ts)` (evidência: `Tests:` sem `failed`)
- `(cd backend && npx tsc --noEmit && npx eslint "src/modules/changelog/**/*.ts")` (evidência: exit 0; nenhuma linha nova em relação aos baselines)
- Review Focus: no caso 401 com `token: 'ghp_secreto'`, `expect(error.message).not.toContain('ghp_secreto')` e `expect(JSON.stringify(error)).not.toContain('ghp_secreto')`; PR com `base` diferente não chega porque a URL fixa `base=<baseBranch>` (evidência: `passed`)

### T-04 — `ChangelogService`: não configurado, cache TTL, stale e 502 + DTOs de resposta

**Camada:** backend
**Dependências:** T-01, T-02, T-03
**Paralelizável:** sim
**Complexidade:** alta
**Agente:** Saitama

**Arquivos prováveis**
- `backend/src/modules/changelog/changelog.service.ts`
- `backend/src/modules/changelog/dto/changelog-response.dto.ts`
- `backend/src/modules/changelog/__tests__/changelog.service.spec.ts`

**Interface**
- Produz: `@Injectable() export class ChangelogService { constructor(client: GithubPullsClient, config: ConfigService); list(limit: number): Promise<ChangelogFeed> }`; em `dto/changelog-response.dto.ts`: `export class ChangelogItemDto implements ChangelogItem` e `export class ChangelogFeedDto implements ChangelogFeed` com `@ApiProperty()` em cada campo (`items` com `type: [ChangelogItemDto]`, `type` com `enum: ['feat', 'fix', 'refactor']`, `scope`/`repository`/`fetchedAt` com `nullable: true`).
- Regras de `list(limit)`: o construtor lê `config.get<string>('GITHUB_REPO')` e `config.getOrThrow<number>('CHANGELOG_CACHE_TTL_SECONDS')`; `GITHUB_REPO` indefinido ou vazio após `trim()` (o `ConfigService` cai no `process.env` e pode devolver `''`, ver `notes.md`) → devolve o payload não configurado de T-02 sem chamar o client. Configurado: cache em memória por repositório com `{ items, fetchedAt }`, válido enquanto `Date.now() - fetchedAt < CHANGELOG_CACHE_TTL_SECONDS * 1000` (TTL 0 = sempre busca); a busca chama `client.listMergedPulls(repo)`, aplica `parseConventionalTitle` a cada `title`, descarta `null`, monta `ChangelogItem` com `title` = `description`, ordena por `mergedAt` decrescente e guarda; chamadas simultâneas com cache vencido compartilham a mesma promessa (uma chamada ao client). Devolve `items.slice(0, limit)`, `repository` = `GITHUB_REPO`, `fetchedAt` em ISO e `stale: false`.
- Erros: `GithubClientError` com cache anterior (mesmo vencido) → devolve o cache com `stale: true`; sem cache → `throw new BadGatewayException({ code: ERROR_CODES.CHANGELOG_SOURCE_UNAVAILABLE, message })`, `message` por `reason`: `timeout` 'O GitHub não respondeu a tempo. Tente novamente em instantes.'; `network` 'Não foi possível conectar ao GitHub.'; `unauthorized` 'O GitHub recusou o GITHUB_TOKEN configurado (401).'; `forbidden` 'O GitHub negou acesso ao repositório configurado (403).'; `not_found` 'Repositório de GITHUB_REPO não encontrado no GitHub (404).'; `rate_limited` 'Limite de requisições do GitHub atingido. Configure GITHUB_TOKEN ou aguarde.'; `http_error` 'O GitHub respondeu com erro inesperado.'. Erro que não é `GithubClientError` é relançado. Log `warn` com `reason` e `status`, nunca o token.
- Consome: T-01 `ERROR_CODES.CHANGELOG_SOURCE_UNAVAILABLE`, T-01 `CHANGELOG_CACHE_TTL_SECONDS: number = 600`, T-02 `export function parseConventionalTitle(title: string): ParsedTitle | null`, T-02 `export interface ChangelogFeed { configured: boolean; repository: string | null; items: ChangelogItem[]; fetchedAt: string | null; stale: boolean }`, T-03 `listMergedPulls(repo: string): Promise<GithubMergedPull[]>`, T-03 `export class GithubClientError extends Error { constructor(reason: GithubErrorReason, status: number | null, message: string); readonly reason: GithubErrorReason; readonly status: number | null }`

**Teste RED**
- `backend/src/modules/changelog/__tests__/changelog.service.spec.ts` — com client mockado (`{ listMergedPulls: jest.fn() }`) e `ConfigService` stub: sem `GITHUB_REPO`, `list(50)` devolve `{ configured: false, repository: null, items: [], fetchedAt: null, stale: false }` e o client não é chamado; com `GITHUB_REPO: 'owner/nome'` e PRs `feat(chat): cita trechos` (#42), `chore: bump` (#43) e `fix: corrige login` (#44, mergeado depois), devolve `items` = [#44 `fix`, #42 `feat` com `title: 'cita trechos'`]; duas chamadas dentro do TTL fazem 1 chamada ao client e, após `jest.setSystemTime` passar do TTL, a terceira faz a 2ª; client rejeitando `new GithubClientError('rate_limited', 403, 'rate limit')` sem cache lança `BadGatewayException` cuja resposta tem `code: 'CHANGELOG_SOURCE_UNAVAILABLE'`, e com cache vencido devolve os itens anteriores com `stale: true` (comando: `cd backend && npx jest src/modules/changelog/__tests__/changelog.service.spec.ts`)

**Critério de aceite**
- O spec do service imprime `Tests:` sem `failed`, com os casos não configurado, filtro/ordenação, TTL, 502 e stale do RED.
- `getResponse()` da `BadGatewayException` lançada contém `code: 'CHANGELOG_SOURCE_UNAVAILABLE'` e a mensagem do `reason`, e o status é `502`.

**Validação**
- `(cd backend && npx jest src/modules/changelog/__tests__/changelog.service.spec.ts)` (evidência: `Tests:` sem `failed`)
- `(cd backend && npx tsc --noEmit && npx eslint "src/modules/changelog/**/*.ts")` (evidência: exit 0; nenhuma linha nova em relação aos baselines)
- Review Focus: `GITHUB_REPO: ''` no stub do `ConfigService` devolve o payload não configurado sem chamar o client; `Promise.all([service.list(50), service.list(50), service.list(50)])` com cache vazio faz `listMergedPulls` ser chamado 1 vez; `list(1)` depois de `list(50)` devolve 1 item sem nova chamada; `CHANGELOG_CACHE_TTL_SECONDS: 0` faz nova chamada a cada `list` (evidência: `passed`)

### T-05 — `GET /changelog`: controller, query DTO, módulo, registro no AppModule e e2e

**Camada:** backend
**Dependências:** T-04
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Aang

**Arquivos prováveis**
- `backend/src/modules/changelog/changelog.controller.ts`
- `backend/src/modules/changelog/changelog.module.ts`
- `backend/src/modules/changelog/dto/changelog-query.dto.ts`
- `backend/src/app.module.ts`
- `backend/test/setup-e2e.ts`
- `backend/test/app.e2e-spec.ts`

**Interface**
- Produz: `GET /changelog?limit=<inteiro 1..100, default 50>` autenticada pelo `JwtAuthGuard` global, sem `@RequirePermissions`, `@TenantScoped` ou `@Public`: 200 `ChangelogFeedDto`; 400 com `limit` fora de 1..100; 401 sem JWT; 502 `CHANGELOG_SOURCE_UNAVAILABLE`. `export class ChangelogQueryDto { limit: number = 50 }` (`@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)`). `ChangelogModule` com `controllers: [ChangelogController]` e providers `ChangelogService` e `{ provide: GithubPullsClient, inject: [ConfigService], useFactory: (config) => new GithubPullsClient({ baseBranch: config.getOrThrow('GITHUB_BASE_BRANCH'), token: config.get('GITHUB_TOKEN'), timeoutMs: config.getOrThrow('GITHUB_TIMEOUT_MS') }) }`, registrado no bloco `// Plataforma` do `imports` de `app.module.ts`, depois de `TenantsModule`. `setup-e2e.ts` fixa `process.env.GITHUB_REPO = ''` (o `.env` local não liga o GitHub no e2e).
- Consome: T-04 `list(limit: number): Promise<ChangelogFeed>`, T-04 `export class ChangelogFeedDto implements ChangelogFeed`, T-03 `export class GithubPullsClient { constructor(options: GithubClientOptions, fetchFn: typeof fetch = globalThis.fetch); listMergedPulls(repo: string): Promise<GithubMergedPull[]> }`

**Teste RED**
- `backend/test/app.e2e-spec.ts` — num `describe('changelog', ...)`: `GET /changelog` sem token responde 401; com `Authorization: Bearer <token>` responde 200 com corpo `{ configured: false, repository: null, items: [], fetchedAt: null, stale: false }`; `GET /changelog?limit=0` com token responde 400; o `GithubPullsClient` sobrescrito por `.overrideProvider(GithubPullsClient).useValue({ listMergedPulls: jest.fn() })` não é chamado (comando: `cd backend && npm run test:e2e -- -t changelog`)

**Critério de aceite**
- `npm run test:e2e` imprime `Tests:` sem `failed`, com os três casos de `/changelog` e os casos anteriores do arquivo.
- Swagger: o controller tem `@ApiTags('changelog')`, `@ApiBearerAuth()` e `@ApiResponse({ status: 200, type: ChangelogFeedDto })` (`grep -c "ApiResponse" backend/src/modules/changelog/changelog.controller.ts` ≥ `1`).

**Validação**
- `(cd backend && npm run test:e2e)` (evidência: `Tests:` sem `failed`, incluindo os casos `changelog`)
- `(cd backend && npx jest src/modules/changelog src/config)` (evidência: specs de T-01..T-04 seguem `passed`)
- `(cd backend && npx tsc --noEmit && npx eslint "{src,test}/**/*.ts")` (evidência: exit 0; nenhuma linha nova em relação aos baselines)

### T-06 — Models `ChangelogFeed`/`ChangelogEntry`, repository e fake de teste

**Camada:** frontend
**Dependências:** T-02
**Paralelizável:** sim
**Complexidade:** simples
**Agente:** Arquimedes

**Arquivos prováveis**
- `frontend/lib/modules/changelog/data/models/changelog_entry.dart`
- `frontend/lib/modules/changelog/data/changelog_repository.dart`
- `frontend/test/support/fake_changelog_repository.dart`
- `frontend/test/changelog/changelog_models_test.dart`

**Interface**
- Produz: em `changelog_entry.dart`: `enum ChangelogType { feat, fix, refactor }` com `static ChangelogType? parse(String? raw)`; `class ChangelogEntry` com `final ChangelogType type; final String? scope; final bool breaking; final String title; final int number; final String url; final DateTime mergedAt;` e `static ChangelogEntry? tryFromJson(Map<String, dynamic> json)` (devolve `null` se `type` ou `mergedAt` não parseiam); `class ChangelogFeed` com `final bool configured; final String? repository; final List<ChangelogEntry> items; final DateTime? fetchedAt; final bool stale;` e `factory ChangelogFeed.fromJson(Map<String, dynamic> json)` (descarta itens com `tryFromJson` nulo, mantém a ordem da API). Em `changelog_repository.dart`: `abstract interface class IChangelogRepository { Future<ChangelogFeed> fetch({int limit = 50}); }` e `class ChangelogRepository implements IChangelogRepository` com construtor `ChangelogRepository(this._client)` (`ApiClient`), que faz `_client.get<Map<String, dynamic>>('/changelog', queryParameters: {'limit': limit})`. Em `test/support/fake_changelog_repository.dart`: `class FakeChangelogRepository implements IChangelogRepository` com `FakeChangelogRepository({this.feed, this.failWith})`, campos `ChangelogFeed? feed`, `AppException? failWith`, `final List<int> calls` (o `limit` de cada chamada).
- Consome: T-02 `{"configured":true,"repository":"owner/nome","items":[{"type":"feat","scope":"chat","breaking":false,"title":"cita trechos","number":42,"url":"https://github.com/owner/nome/pull/42","mergedAt":"2026-09-20T12:00:00Z"}],"fetchedAt":"2026-09-28T16:00:00.000Z","stale":false}`, T-02 `{"configured":false,"repository":null,"items":[],"fetchedAt":null,"stale":false}`

**Teste RED**
- `frontend/test/changelog/changelog_models_test.dart` — `ChangelogFeed.fromJson` do payload configurado de T-02 (com um item extra de `type: 'chore'`) devolve `configured: true`, `repository: 'owner/nome'`, 1 item com `type == ChangelogType.feat`, `scope == 'chat'`, `number == 42`, `mergedAt == DateTime.utc(2026, 9, 20, 12)`; o payload não configurado devolve `configured == false`, `items` vazio e `fetchedAt == null` (comando: `cd frontend && fvm flutter test test/changelog/changelog_models_test.dart`)

**Critério de aceite**
- `fvm flutter test test/changelog/changelog_models_test.dart` imprime `All tests passed!`.
- `fvm flutter analyze` imprime `No issues found!`.

**Validação**
- `(cd frontend && fvm flutter test test/changelog/changelog_models_test.dart)` (evidência: `All tests passed!`)
- `(cd frontend && fvm flutter analyze)` (evidência: `No issues found!`, igual a `baseline/frontend-analyze.txt`)

### T-07 — `ChangelogController`: estados, agrupamento, recentes e cache de sessão

**Camada:** frontend
**Dependências:** T-06
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Spock

**Arquivos prováveis**
- `frontend/lib/modules/changelog/presentation/changelog_controller.dart`
- `frontend/test/changelog/changelog_controller_test.dart`

**Interface**
- Produz: `enum ChangelogViewState { loading, ready, empty, notConfigured, error }`; `typedef ChangelogGroup = ({ChangelogType type, String label, List<ChangelogEntry> items});`; `const Map<ChangelogType, String> changelogTypeLabels = {ChangelogType.feat: 'Novas funcionalidades', ChangelogType.fix: 'Correções', ChangelogType.refactor: 'Melhorias'};`; `class ChangelogController extends ChangeNotifier` com construtor `ChangelogController(this._repository)` (`IChangelogRepository`), getters `ChangelogViewState get state` (inicial `loading`), `String? get error`, `ChangelogFeed? get feed`, `List<ChangelogGroup> get groups`, `bool get stale` (`feed?.stale ?? false`), `bool get hasLoaded` (inicial `false`), e os métodos `Future<void> load()`, `Future<void> ensureLoaded()` e `List<ChangelogEntry> recent(int count)`.
- Regras de `load()` (busca forçada): estado `loading` e `notifyListeners()`; `fetch()` com o `limit` padrão; `configured == false` → `notConfigured`; `items` vazio → `empty`; senão `ready`; nos três casos `hasLoaded = true`. `AppException` → `error` com `e.message`; outra exceção → `error` com 'Não foi possível carregar as novidades.'; em erro `hasLoaded` fica como estava. Chamada de `load()` com outra em andamento devolve a mesma `Future` (uma chamada ao repository).
- Regras de `ensureLoaded()` (cache de sessão do front): se `hasLoaded` é `true`, não chama o repository e não notifica; senão delega a `load()` (compartilhando a busca em andamento). O controller é `addLazySingleton` no escopo do shell (T-08), então card da tela de início e página Novidades dividem o mesmo feed: abrir as duas na sessão faz uma chamada à API.
- `groups` na ordem feat, fix, refactor, sem grupo vazio, itens na ordem do feed. `recent(count)` devolve os `count` primeiros itens de `feed.items` (a API já ordena por `mergedAt` decrescente) ou lista vazia sem feed.
- Consome: T-06 `abstract interface class IChangelogRepository { Future<ChangelogFeed> fetch({int limit = 50}); }`, T-06 `class FakeChangelogRepository implements IChangelogRepository`, T-06 `enum ChangelogType { feat, fix, refactor }`

**Teste RED**
- `frontend/test/changelog/changelog_controller_test.dart` — com `FakeChangelogRepository`: feed `configured: false` leva `state` a `ChangelogViewState.notConfigured`; feed configurado sem itens leva a `empty`; feed com itens refactor, feat, fix, feat leva a `ready` e `groups.map((g) => g.label)` == `['Novas funcionalidades', 'Correções', 'Melhorias']` com 2 itens no primeiro; `recent(2)` devolve os dois primeiros itens do feed; `ensureLoaded()` chamado duas vezes em sequência e depois `Future.wait([c.ensureLoaded(), c.ensureLoaded()])` num controller novo resultam em `fake.calls.length == 1` em cada controller; `failWith: AppException(message: 'O GitHub não respondeu a tempo. Tente novamente em instantes.', statusCode: 502, code: 'CHANGELOG_SOURCE_UNAVAILABLE')` leva a `error` com `error` igual a essa mensagem e `hasLoaded == false` (comando: `cd frontend && fvm flutter test test/changelog/changelog_controller_test.dart`)

**Critério de aceite**
- `fvm flutter test test/changelog/changelog_controller_test.dart` imprime `All tests passed!`.
- `fvm flutter analyze` imprime `No issues found!`.

**Validação**
- `(cd frontend && fvm flutter test test/changelog/)` (evidência: `All tests passed!`)
- `(cd frontend && fvm flutter analyze)` (evidência: `No issues found!`, igual a `baseline/frontend-analyze.txt`)
- Review Focus: `load()` chamado de novo depois de `error` volta a `ready` quando o fake deixa de falhar (`failWith = null`); `ensureLoaded()` depois de um erro chama o repository de novo; `groups` omite o grupo `Melhorias` quando não há `refactor` (evidência: `All tests passed!`)

### T-08 — Página Novidades, módulo, rota `/home/changelog`, item de menu, selo de tipo e `url_launcher`

**Camada:** frontend
**Dependências:** T-07
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Tesla

**Arquivos prováveis**
- `frontend/lib/modules/changelog/changelog_module.dart`
- `frontend/lib/modules/changelog/presentation/changelog_page.dart`
- `frontend/lib/modules/changelog/presentation/widgets/changelog_group_section.dart`
- `frontend/lib/modules/changelog/presentation/widgets/changelog_entry_tile.dart`
- `frontend/lib/modules/changelog/presentation/widgets/changelog_type_badge.dart`
- `frontend/lib/modules/home/home_module.dart`
- `frontend/lib/core/routing/nav_destinations.dart`
- `frontend/pubspec.yaml`
- `frontend/pubspec.lock`
- `frontend/test/changelog/changelog_navigation_test.dart`

**Interface**
- Produz: `void registerChangelogBinds(ModularContext c)` (`addLazySingleton<IChangelogRepository>` com `ChangelogRepository(inject<ApiClient>())` e `addLazySingleton<ChangelogController>` com `ChangelogController(inject<IChangelogRepository>())`) e `void registerChangelogRoutes(ModularContext r)` (`r.route('/changelog', child: ...)` → `/home/changelog`), chamados em `home_module.dart` ao lado de `registerUsersBinds`/`registerUsersRoutes`. Item `NavDestination(label: 'Novidades', icon: Icons.campaign_outlined, route: '/home/changelog', description: 'Atualizações do produto')` sem `requiredPermissions` e sem `group`, como último elemento de `navDestinations` (vai para `sidebarLayout.bottomLoose`).
- Produz: `class ChangelogTypeBadge extends StatelessWidget` com `const ChangelogTypeBadge({super.key, required this.type, this.compact = false})` (`final ChangelogType type; final bool compact;`), que mostra ícone e rótulo curto do tipo, cores via `context.colors`; `const Map<ChangelogType, IconData> changelogTypeIcons = {ChangelogType.feat: Icons.auto_awesome_outlined, ChangelogType.fix: Icons.build_outlined, ChangelogType.refactor: Icons.tune_outlined};` e `const Map<ChangelogType, String> changelogTypeShortLabels = {ChangelogType.feat: 'Novidade', ChangelogType.fix: 'Correção', ChangelogType.refactor: 'Melhoria'};` no mesmo arquivo; `compact: true` mostra só o ícone com `Tooltip` do rótulo.
- Produz: `ChangelogPage` (StatefulWidget: `inject<ChangelogController>()` no `initState`, `ensureLoaded()` em `addPostFrameCallback`, `AnimatedBuilder` + `switch` no estado): `loading` → `AppLoadingView()`; `notConfigured` → `AppEmptyView(message: 'As novidades ainda não foram configuradas. Defina GITHUB_REPO no backend para listar as atualizações do produto.', icon: Icons.campaign_outlined)`; `empty` → `AppEmptyView(message: 'Nenhuma novidade publicada ainda.', icon: Icons.campaign_outlined)`; `error` → `AppErrorView(message: controller.error ?? 'Não foi possível carregar as novidades.', onRetry: controller.load)`; `ready` → um `ChangelogGroupSection` por grupo, com `AppInlineNotice(tone: AppNoticeTone.warning, icon: Icons.cloud_off_outlined, message: 'Exibindo a última lista obtida: o GitHub está indisponível no momento.')` no topo quando `stale`. `ChangelogEntryTile` mostra `ChangelogTypeBadge(compact: true)`, `title`, `scope` (se houver), selo 'Breaking' quando `breaking`, `formatDate(mergedAt.toLocal())` e o `#<number>`, que ao toque chama `launchUrl(Uri.parse(entry.url), webOnlyWindowName: '_blank')` do `url_launcher`; se `launchUrl` devolver `false` ou lançar, copia `url` com `Clipboard.setData(ClipboardData(text: entry.url))` e chama `showAppToast(context, 'Não foi possível abrir o PR; link #<number> copiado.', type: AppToastType.warning)`. Dependência `url_launcher` adicionada por `fvm flutter pub add url_launcher` em `pubspec.yaml`/`pubspec.lock` (só esta task a adiciona; aprovada pelo usuário).
- Consome: T-07 `class ChangelogController extends ChangeNotifier`, T-07 `enum ChangelogViewState { loading, ready, empty, notConfigured, error }`, T-07 `typedef ChangelogGroup = ({ChangelogType type, String label, List<ChangelogEntry> items});`, T-07 `Future<void> ensureLoaded()`, T-06 `class ChangelogRepository implements IChangelogRepository`

**Teste RED**
- `frontend/test/changelog/changelog_navigation_test.dart` — `HomeShellController` com `PermissionService` de usuário sem permissões (`permissions: <String>{}`) tem em `visibleDestinations` um item `label == 'Novidades'` com `route == '/home/changelog'` e `requiredPermissions` vazio, e esse item está em `sidebarLayout.bottomLoose`; `changelogTypeShortLabels` e `changelogTypeIcons` têm chave para os três valores de `ChangelogType.values` (comando: `cd frontend && fvm flutter test test/changelog/changelog_navigation_test.dart`)

**Critério de aceite**
- `fvm flutter test` (suíte inteira) imprime `All tests passed!`, incluindo `test/rag_assistant/rag_navigation_test.dart` sem alteração.
- `fvm flutter analyze` imprime `No issues found!`.
- `grep -n "url_launcher" frontend/pubspec.yaml` lista a dependência, e `pubspec.yaml` e `pubspec.lock` estão no mesmo commit `Task: T-08`.

**Validação**
- `(cd frontend && fvm flutter test)` (evidência: `All tests passed!`)
- `(cd frontend && fvm flutter analyze)` (evidência: `No issues found!`, igual a `baseline/frontend-analyze.txt`)
- `(cd frontend && fvm flutter build web --no-pub)` (evidência: `✓ Built build/web`)

### T-09 — README e `backend/CLAUDE.md`: configuração do GitHub e módulo `changelog`

**Camada:** docs
**Dependências:** T-01, T-05
**Paralelizável:** sim
**Complexidade:** simples
**Agente:** Gandalf

**Arquivos prováveis**
- `README.md`
- `backend/CLAUDE.md`

**Interface**
- Produz: seção `### Novidades (GitHub)` em `README.md` § Setup rápido com a tabela das envs (`GITHUB_REPO`, `GITHUB_TOKEN`, `GITHUB_BASE_BRANCH`, `GITHUB_TIMEOUT_MS`, `CHANGELOG_CACHE_TTL_SECONDS`), a regra do título (`feat`/`fix`/`refactor` com escopo e `!` opcionais), o comportamento sem `GITHUB_REPO` (200 `configured: false`), o 502 `CHANGELOG_SOURCE_UNAVAILABLE` e o rate limit de 60 req/h sem token; linha `changelog` na tabela `## Módulos` do README; `changelog` na família **Plataforma** da tabela de `backend/CLAUDE.md`.
- Consome: T-01 `ERROR_CODES.CHANGELOG_SOURCE_UNAVAILABLE`, T-05 `GET /changelog?limit=<inteiro 1..100, default 50>`

**Teste RED**
- sem teste: task só de documentação; a verificação é por `grep` nos arquivos.

**Critério de aceite**
- `grep -c "GITHUB_REPO\|GITHUB_TOKEN\|GITHUB_BASE_BRANCH\|GITHUB_TIMEOUT_MS\|CHANGELOG_CACHE_TTL_SECONDS" README.md` imprime ≥ `5`.
- `grep -n "changelog" backend/CLAUDE.md` mostra `changelog` na linha da família Plataforma.
- Nenhum valor real de token no diff (`git diff <BASE> -- README.md | grep -c "ghp_"` imprime `0`).

**Validação**
- `grep -n "Novidades (GitHub)\|CHANGELOG_SOURCE_UNAVAILABLE\|/changelog" README.md` (evidência: a seção, o código de erro e a rota)
- `grep -n "Plataforma" backend/CLAUDE.md` (evidência: a linha inclui `changelog`)

### T-11 — Card "Novidades recentes" na tela de início

**Camada:** frontend
**Dependências:** T-08
**Paralelizável:** não
**Complexidade:** média
**Agente:** Athena

**Arquivos prováveis**
- `frontend/lib/modules/changelog/presentation/widgets/changelog_recent_card.dart`
- `frontend/lib/modules/home/presentation/dashboard_page.dart`

**Interface**
- Produz: `class ChangelogRecentCard extends StatefulWidget` com `const ChangelogRecentCard({super.key, this.count = 5})` (`final int count;`): no `initState` resolve `inject<ChangelogController>()` (o mesmo singleton da página, registrado por T-08) e chama `ensureLoaded()` em `addPostFrameCallback`; `AnimatedBuilder` sobre o controller. Envolve o conteúdo em `AppSectionCard(title: 'Novidades recentes', action: TextButton(onPressed: () => context.navigate('/home/changelog'), child: const Text('Ver todas')), child: ...)`. Estados compactos (altura de uma linha, sem `AppLoadingView`/`AppEmptyView` de tela cheia): `loading` → `LinearProgressIndicator`; `notConfigured` → `Text('Novidades ainda não configuradas.')`; `empty` → `Text('Nenhuma novidade publicada ainda.')`; `error` → a mensagem de `controller.error` e `TextButton(onPressed: controller.load, child: const Text('Tentar novamente'))`; `ready` → uma linha por item de `controller.recent(count)` com `ChangelogTypeBadge(type: e.type, compact: true)`, `title` (uma linha, `TextOverflow.ellipsis`) e `formatShortDate(mergedAt.toLocal())`. Cores via `context.colors`, espaçamentos via `AppDimensions`, textos via `context.textStyles`.
- Produz: `DashboardPage` passa a mostrar, abaixo da saudação, `const ChangelogRecentCard()` com largura máxima limitada (`ConstrainedBox(maxWidth: 560)`), num `SingleChildScrollView` para caber em tela baixa; o card aparece para qualquer usuário logado (sem checagem de permissão). O texto 'O assistente de conhecimento chega nos próximos módulos.' é removido (o RAG já tem tela).
- Consome: T-07 `Future<void> ensureLoaded()`, T-07 `List<ChangelogEntry> recent(int count)`, T-07 `enum ChangelogViewState { loading, ready, empty, notConfigured, error }`, T-08 `class ChangelogTypeBadge extends StatelessWidget`, T-08 `r.route('/changelog', child: ...)`

**Teste RED**
- sem teste: widget só de apresentação; a lógica que ele usa (`ensureLoaded`, `recent`, estados) é testada em T-07 e o registro no menu/rota em T-08. Widget test aqui falharia por ambiente: `context.textStyles` usa `GoogleFonts`, que faz `rethrow` quando não baixa a fonte em `flutter test` (`google_fonts-8.2.1/lib/src/google_fonts_base.dart`, bloco `catch (e)`), e o projeto não tem nenhum `testWidgets`.

**Critério de aceite**
- `grep -n "ChangelogRecentCard" frontend/lib/modules/home/presentation/dashboard_page.dart` lista o uso do card.
- `grep -c "requiredPermissions\|PermissionService().can\|canAny" frontend/lib/modules/changelog/presentation/widgets/changelog_recent_card.dart` imprime `0` (card sem checagem de permissão).
- `fvm flutter analyze` imprime `No issues found!` e `fvm flutter build web --no-pub` imprime `✓ Built build/web`.
- Os arquivos novos respeitam 300 linhas por arquivo (`wc -l` ≤ 300) e o hook `check-complexity.sh` não bloqueia.

**Validação**
- `(cd frontend && fvm flutter analyze)` (evidência: `No issues found!`, igual a `baseline/frontend-analyze.txt`)
- `(cd frontend && fvm flutter test)` (evidência: `All tests passed!`, a suíte de T-06..T-08 segue verde)
- `(cd frontend && fvm flutter build web --no-pub)` (evidência: `✓ Built build/web`)
- `grep -n "navigate('/home/changelog')\|recent(\|ensureLoaded" frontend/lib/modules/changelog/presentation/widgets/changelog_recent_card.dart` (evidência: as três chamadas presentes)

### T-10 — Validação integral backend + frontend na branch

**Camada:** qa
**Dependências:** T-08, T-09, T-11
**Paralelizável:** não
**Complexidade:** simples
**Agente:** Sherlock

**Arquivos prováveis**

Nenhum: task read-only, não commita.

**Interface**
- Produz: nada
- Consome: nada

**Teste RED**
- sem teste: task de validação integral, sem código novo; os RED das tasks anteriores já estão no histórico.

**Critério de aceite**
- `npm test`, `npm run test:e2e`, `npx tsc --noEmit` e `npx eslint "{src,test}/**/*.ts"` em `backend/` terminam com exit 0 e `Tests:` sem `failed`.
- `fvm flutter analyze` imprime `No issues found!` e `fvm flutter test` imprime `All tests passed!` em `frontend/`.
- `git -C /home/kaine/source/geduc-rag status --short -- backend frontend` não lista arquivo modificado nem novo.
- `git -C /home/kaine/source/geduc-rag diff --name-only <BASE da onda 1>..HEAD -- backend/prisma` não lista arquivo (sem migration).

**Validação**
- `(cd backend && npm test && npm run test:e2e && npx tsc --noEmit && npx eslint "{src,test}/**/*.ts")` (evidência: `Tests:` sem `failed` nas duas suítes e exit 0; nenhuma linha nova em relação a `baseline/backend-tsc.txt` e `baseline/backend-eslint.txt`)
- `(cd frontend && fvm flutter analyze && fvm flutter test)` (evidência: `No issues found!` e `All tests passed!`)
- `git -C /home/kaine/source/geduc-rag diff --name-only <BASE da onda 1>..HEAD -- backend/prisma` (evidência: saída vazia)

## Legenda

- [ ] pendente
- [~] em andamento
- [x] concluído com evidência
- [!] bloqueado
