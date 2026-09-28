# Plan: Novidades do produto a partir de PRs mergeados no GitHub

## Objetivo
Criar a tela "Novidades", visível a qualquer usuário logado, que lista as atualizações do produto (feat, fix, refactor) vindas dos pull requests mergeados do repositório GitHub configurado. O backend expõe `GET /changelog` com cache em memória e funciona desconfigurado: sem `GITHUB_REPO`, responde lista vazia com `configured: false`.

## Premissas
- Fonte: PRs mergeados na branch base (`GITHUB_BASE_BRANCH`, default `main`) cujo título segue Conventional Commits com tipo `feat`, `fix` ou `refactor`, escopo e `!` opcionais. O tipo é aceito sem diferenciar maiúsculas (`Feat:` conta) e sai normalizado em minúsculas. Os demais PRs são ignorados.
- A busca lê uma página de até 100 PRs fechados, ordenados por `updated` decrescente. Changelog mais antigo que isso fica fora (ver `notes.md § Decisões`).
- O agrupamento por tipo acontece no frontend: a API devolve lista plana ordenada por `mergedAt` decrescente.
- O `#número` do PR abre o link numa aba nova com `url_launcher` (dependência aprovada pelo usuário, adicionada só em T-08); se a abertura falhar, o link é copiado para a área de transferência com toast.
- A tela de início ganha o card "Novidades recentes" (últimos 5 itens), visível a qualquer usuário logado. Card e página dividem o mesmo `ChangelogController` singleton do shell, que guarda o feed na sessão: abrir os dois faz uma chamada à API.
- Não há migration nem persistência: o cache vive na memória do processo e é perdido no restart.
- Os testes não usam rede: o client do GitHub recebe `fetch` injetado e o e2e sobrescreve o provider.

## Escopo

### Incluso
- Envs `GITHUB_REPO`, `GITHUB_TOKEN`, `GITHUB_BASE_BRANCH`, `GITHUB_TIMEOUT_MS` e `CHANGELOG_CACHE_TTL_SECONDS`, validadas e documentadas em `.env.example` (T-01).
- Código de erro `CHANGELOG_SOURCE_UNAVAILABLE` (502) (T-01).
- Parser de título Conventional Commits e contrato do payload (T-02).
- Client REST do GitHub com timeout, header de token opcional e erros tipados sem vazar o token (T-03).
- Service com estado não configurado, cache TTL, deduplicação de chamadas simultâneas, cache vencido servido como `stale` e 502 (T-04).
- Rota `GET /changelog` autenticada, sem RBAC e sem tenant, com `limit` 1..100 e e2e (T-05).
- Frontend: models, repository, controller com estados, agrupamento, recentes e cache de sessão, página, rota `/home/changelog` e item de menu "Novidades" para todos (T-06, T-07, T-08).
- Card "Novidades recentes" na tela de início, com estados compactos e link "Ver todas" (T-11).
- README e `backend/CLAUDE.md` (T-09).
- Validação integral (T-10).

### Excluído
- Persistência do changelog no banco, migration ou job agendado.
- Permissão RBAC nova ou filtro por tenant.
- Webhook do GitHub, criação de remote, instalação do `gh` ou `git push`.
- Paginação além da primeira página de 100 PRs da API do GitHub.
- Chamada real ao GitHub nos testes.
- Edição do `.env` local.
- Teste de widget (`testWidgets`) do card: o `GoogleFonts` do tema faz `rethrow` sem rede em `flutter test`.

## Contexto técnico
- Camadas envolvidas: backend, frontend, docs, qa
- Projeto/base analisada: /home/kaine/source/geduc-rag (raiz de `git rev-parse --show-toplevel`; repositório único, monorepo `backend/` + `frontend/`)
- Integrações: API REST do GitHub (`GET /repos/{owner}/{repo}/pulls`), só em runtime e só com `GITHUB_REPO` definido

## Baseline
- nenhuma. `npx tsc --noEmit` e `npx eslint "{src,test}/**/*.ts"` (sem `--fix`) em `backend/` saem com exit 0 e saída vazia (`baseline/backend-tsc.txt`, 0 linhas; `baseline/backend-eslint.txt`, 0 linhas); `fvm flutter analyze` em `frontend/` imprime `No issues found!` (`baseline/frontend-analyze.txt`, 3 linhas, com um aviso de kernel binary do FVM que não é issue). O critério das tasks é "nenhuma linha nova em relação ao baseline", ou seja, exit 0 e `No issues found!`.

## Exploração read-only
- Caminhos relevantes: `backend/src/modules/profiles/` (modelo de módulo de plataforma Controller → Service, `dto/*-response.dto.ts` com `@ApiProperty`), `backend/src/modules/users/__tests__/` (padrão de spec), `backend/src/app.module.ts` (bloco `// Plataforma`), `backend/src/common/errors/error-codes.ts` (`ERROR_CODES` `as const`), `backend/src/common/filters/all-exceptions.filter.ts`, `backend/src/config/env.validation.ts` (class-validator) e `__tests__/env.validation.spec.ts`, `backend/src/modules/generation/infra/gateways/ollama-llm-provider.gateway.ts` (`fetchFn` injetável + `AbortSignal.timeout`), `backend/test/setup-e2e.ts` e `backend/test/app.e2e-spec.ts` (Prisma stubado); `frontend/lib/modules/users/` (módulo por `registerXBinds`/`registerXRoutes`), `frontend/lib/modules/home/home_module.dart`, `frontend/lib/core/routing/nav_destinations.dart`, `frontend/lib/core/http/api_client.dart`, `frontend/lib/core/errors/app_exception.dart`, `frontend/lib/shared/components/feedback/app_state_views.dart` e `app_inline_notice.dart`, `frontend/lib/shared/utils/app_date_formats.dart`, `frontend/lib/shared/components/layout/app_section_card.dart`, `frontend/lib/modules/home/presentation/dashboard_page.dart`, `frontend/test/support/`, `frontend/test/rag_assistant/rag_navigation_test.dart`.
- Padrões identificados: rota "só autenticada" = handler sem `@RequirePermissions`, `@TenantScoped` e `@Public` (o `PermissionsGuard` libera sem metadata); erro de domínio = `new XxxException({ code: ERROR_CODES.X, message })`; chamadas externas com `fetch` nativo (sem axios); envs opcionais com default via `@Type(() => Number) @IsInt()`; `ConfigService.get`/`getOrThrow`. Frontend: `ChangeNotifier` + enum de estado por módulo, `AppException` lançada pelo `ApiClient`, `fromJson` manual, fakes `implements I...Repository` com `failWith`; `NavDestination` com `requiredPermissions` vazio é visível a todos, e item sem `group` depois do último agrupado vai para `bottomLoose`.
- Scripts úteis: backend `npx jest <spec>`, `npm test`, `npm run test:e2e`, `npx tsc --noEmit`, `npx eslint "{src,test}/**/*.ts"` (sem `--fix`; `npm run lint` e `npm run format` escrevem); frontend `fvm flutter test`, `fvm flutter analyze`, `fvm flutter build web --no-pub`.
- Riscos identificados: `backend/.env` existe e o `ConfigModule` o carrega no e2e (mitigado por `GITHUB_REPO=''` em `setup-e2e.ts` e override do client); `ConfigService.get` cai em `process.env` e devolve `''` quando a env vazia foi convertida em `undefined` na validação (T-04 trata vazio como não configurado); rate limit de 60 req/h sem token (cache TTL + stale); `GoogleFonts` em `context.textStyles` impede teste de widget sem rede (nenhum `testWidgets` no projeto); hooks `format-file.sh` (eslint --fix / dart format pós-edição) e `check-complexity.sh` (limite de complexidade no Stop).

## Mapa de arquivos

| Arquivo | Responsabilidade | Ação | Tasks que tocam |
|---|---|---|---|
| `backend/src/config/env.validation.ts` | Envs do changelog com default e validação | modificar | T-01 |
| `backend/src/config/__tests__/env.validation.spec.ts` | Casos das envs novas | modificar | T-01 |
| `backend/src/common/errors/error-codes.ts` | `CHANGELOG_SOURCE_UNAVAILABLE` | modificar | T-01 |
| `backend/.env.example` | Seção Changelog (GitHub) com placeholders | modificar | T-01 |
| `backend/src/modules/changelog/changelog.types.ts` | Contrato `ChangelogType`/`ChangelogItem`/`ChangelogFeed` | criar | T-02 |
| `backend/src/modules/changelog/changelog-title.parser.ts` | `parseConventionalTitle` | criar | T-02 |
| `backend/src/modules/changelog/__tests__/changelog-title.parser.spec.ts` | Casos do parser | criar | T-02 |
| `backend/src/modules/changelog/github-pulls.client.ts` | Chamada REST ao GitHub, timeout, erros tipados | criar | T-03 |
| `backend/src/modules/changelog/__tests__/github-pulls.client.spec.ts` | Client com `fetch` mockado | criar | T-03 |
| `backend/src/modules/changelog/changelog.service.ts` | Não configurado, cache TTL, stale, 502 | criar | T-04 |
| `backend/src/modules/changelog/dto/changelog-response.dto.ts` | DTOs Swagger da resposta | criar | T-04 |
| `backend/src/modules/changelog/__tests__/changelog.service.spec.ts` | Service com client mockado e relógio falso | criar | T-04 |
| `backend/src/modules/changelog/changelog.controller.ts` | `GET /changelog` | criar | T-05 |
| `backend/src/modules/changelog/changelog.module.ts` | Providers e factory do client | criar | T-05 |
| `backend/src/modules/changelog/dto/changelog-query.dto.ts` | `limit` 1..100 | criar | T-05 |
| `backend/src/app.module.ts` | Registro do `ChangelogModule` em Plataforma | modificar | T-05 |
| `backend/test/setup-e2e.ts` | `GITHUB_REPO=''` no e2e | modificar | T-05 |
| `backend/test/app.e2e-spec.ts` | Casos de `/changelog` e override do client | modificar | T-05 |
| `frontend/lib/modules/changelog/data/models/changelog_entry.dart` | `ChangelogType`, `ChangelogEntry`, `ChangelogFeed` | criar | T-06 |
| `frontend/lib/modules/changelog/data/changelog_repository.dart` | `IChangelogRepository` e implementação Dio | criar | T-06 |
| `frontend/test/support/fake_changelog_repository.dart` | Fake do repository | criar | T-06 |
| `frontend/test/changelog/changelog_models_test.dart` | `fromJson` dos models | criar | T-06 |
| `frontend/lib/modules/changelog/presentation/changelog_controller.dart` | Estados e agrupamento | criar | T-07 |
| `frontend/test/changelog/changelog_controller_test.dart` | Controller com fake | criar | T-07 |
| `frontend/lib/modules/changelog/changelog_module.dart` | Binds e rota `/changelog` | criar | T-08 |
| `frontend/lib/modules/changelog/presentation/changelog_page.dart` | Página e estados | criar | T-08 |
| `frontend/lib/modules/changelog/presentation/widgets/changelog_group_section.dart` | Seção por tipo | criar | T-08 |
| `frontend/lib/modules/changelog/presentation/widgets/changelog_entry_tile.dart` | Item com escopo, data e cópia do link do PR | criar | T-08 |
| `frontend/lib/modules/changelog/presentation/widgets/changelog_type_badge.dart` | Ícone e rótulo curto por tipo | criar | T-08 |
| `frontend/lib/modules/home/home_module.dart` | Chama `registerChangelogBinds`/`Routes` | modificar | T-08 |
| `frontend/lib/core/routing/nav_destinations.dart` | Item "Novidades" | modificar | T-08 |
| `frontend/pubspec.yaml` | Dependência `url_launcher` | modificar | T-08 |
| `frontend/pubspec.lock` | Lockfile | modificar | T-08 |
| `frontend/test/changelog/changelog_navigation_test.dart` | Visibilidade do item no menu e mapas do selo | criar | T-08 |
| `frontend/lib/modules/changelog/presentation/widgets/changelog_recent_card.dart` | Card compacto dos 5 mais recentes | criar | T-11 |
| `frontend/lib/modules/home/presentation/dashboard_page.dart` | Tela de início com o card | modificar | T-11 |
| `README.md` | Configuração do GitHub e tabela de módulos | modificar | T-09 |
| `backend/CLAUDE.md` | `changelog` na família Plataforma | modificar | T-09 |

Nenhum arquivo é tocado por mais de uma task: os globais (`app.module.ts`, `error-codes.ts`, `env.validation.ts`, `.env.example`, `setup-e2e.ts`, `app.e2e-spec.ts`, `home_module.dart`, `nav_destinations.dart`, `dashboard_page.dart`, `pubspec.yaml`, `pubspec.lock`, `README.md`) têm um único dono. `home_module.dart` e `pubspec.*` ficam só em T-08; T-11 só edita `dashboard_page.dart`, que já é rota do shell.

## Decisões de arquitetura

| Decisão | Alternativas consideradas | Motivo da escolha |
|---|---|---|
| REST `GET /repos/{repo}/pulls?state=closed&base=<branch>` filtrando `merged_at` | Search API `is:pr is:merged base:<branch>` | A Search API tem limite próprio de 10 req/min sem token (30 com token), atraso de indexação e payload diferente; a listagem de pulls filtra a base na query e devolve `merged_at` e `html_url` diretamente. |
| Client `GithubPullsClient` com `fetch` injetável, instanciado por factory em `ChangelogModule` | `@nestjs/axios`; gateway atrás de interface (padrão RAG) | Mesmo padrão do `OllamaLlmProviderGateway` (fetch nativo, `AbortSignal.timeout`), sem dependência nova; módulo de plataforma não ganha gateway/use case (`backend/CLAUDE.md`), então é uma classe concreta usada como token de DI e mockável no spec e no e2e. |
| Cache em memória por repositório no próprio service, com deduplicação da busca em andamento | `@nestjs/cache-manager`; cache no banco | Sem dependência nem migration; uma instância; a deduplicação evita N chamadas quando o cache vence sob carga. |
| Cache vencido servido com `stale: true` quando o GitHub falha; sem cache → 502 `CHANGELOG_SOURCE_UNAVAILABLE` | Sempre 502; sempre 200 vazio | O usuário continua vendo as novidades já obtidas; o 502 com código permite ao front mostrar erro com tentar de novo. |
| Não configurado = 200 `configured: false` | 404; 503 | Decisão do usuário: sem erro, o front mostra estado vazio explicativo. |
| Agrupamento por tipo no frontend | Backend devolve grupos | A lista plana serve outros consumidores; os rótulos de exibição ficam na UI. |
| `#número` abre o PR com `url_launcher` (`launchUrl`, `webOnlyWindowName: '_blank'`), com cópia do link como fallback | Só copiar o link; `dart:js_interop` com import condicional | Aprovado pelo usuário; pacote oficial que compila na VM de teste e na web, enquanto `js_interop` quebra `flutter test` sem import condicional. O fallback cobre bloqueio de pop-up. |
| Card e página dividem o `ChangelogController` singleton com `ensureLoaded()` (cache de sessão no front) | Controller próprio do card com `fetch(limit: 5)`; sem cache no front | Uma chamada à API por sessão para as duas telas; o cache do backend protege o GitHub, o do front evita a segunda ida ao backend. `load()` segue como atualização forçada ("Tentar novamente"). |
| Card em `modules/changelog/presentation/widgets/`, usado por `dashboard_page.dart` | Card em `modules/home/presentation/widgets/` | O card depende só de símbolos do módulo changelog; o home só o compõe, e `home_module.dart` não muda em T-11. |

## Diagrama de dependências

```text
T-01 ─┐
T-02 ─┼─→ T-04 → T-05 ─┬─→ T-09 ───────────┐
T-03 ─┘                │                   ├─→ T-10
T-02 → T-06 → T-07 → T-08 ─┬─→ T-11 ───────┤
                           └───────────────┘
T-01 ──────────────────┘ (T-09)
```

## Estratégia de execução
- Branch de trabalho: `task/assistente-rag-ollama` (a branch atual; sem branch nova, por decisão do usuário)
- Branch base: `task/assistente-rag-ollama` (BASE da onda 1 = HEAD no início da execução, hoje 87b7179)
- Commits da onda: cada implementador commita os próprios caminhos (`git commit -- <caminhos>`); com `worktree por agente` eles chegam pelos merges de `wave<N>/T-XX`. O fechador usa a skill `new-commit --auto` só se sobrou algo sem commit e sempre registra o estado das tasks num `chore(tasks): registra commits da onda N`.
- Isolamento em ondas com edições paralelas: caminho exclusivo, no checkout principal `/home/kaine/source/geduc-rag` (sem worktree, por decisão do usuário). Nenhum arquivo é compartilhado entre tasks. `frontend/pubspec.yaml`/`pubspec.lock` têm dono único (T-08), e só ele roda `fvm flutter pub add url_launcher`. Nenhuma task roda `npm install` nem `npx prisma generate`.

## Ondas de execução

### Onda 1
- T-01, T-02, T-03 (backend: envs/erro, contrato/parser, client — arquivos disjuntos)

### Onda 2
- T-04 (backend: service), T-06 (frontend: models e repository)

### Onda 3
- T-05 (backend: rota, módulo, e2e), T-07 (frontend: controller)

### Onda 4
- T-08 (frontend: página, rota e menu), T-09 (docs)

### Onda 5
- T-11 (frontend: card na tela de início; escritor único da onda)

### Onda 6
- T-10 (validação integral, read-only)

## Agentes

| Agente | subagent_type | model | Tasks |
|---|---|---|---|
| Sun Tzu — orquestrador | — | — | todas |
| Levi | general-purpose | inherit | T-01 |
| Platão | general-purpose | inherit | T-02 |
| Naruto | general-purpose | inherit | T-03 |
| Saitama | general-purpose | inherit | T-04 |
| Aang | general-purpose | inherit | T-05 |
| Arquimedes | general-purpose | inherit | T-06 |
| Spock | general-purpose | inherit | T-07 |
| Tesla | general-purpose | inherit | T-08 |
| Gandalf | geduc:documentador | sonnet | T-09 |
| Athena | general-purpose | inherit | T-11 |
| Sherlock | geduc:validador | sonnet | T-10 |

## Review Focus
- `GITHUB_REPO=` e `GITHUB_TOKEN=` vazios no `.env` → boot não falha e `GET /changelog` responde `configured: false` sem chamar o GitHub → T-01
- Título com espaços nas pontas ou tipo em maiúsculas (`  Feat(Chat):  Novo menu  `, `FIX: x`) → aceito como `feat`/`fix` com escopo e descrição aparados → T-02
- GitHub responde 401 com token configurado → erro `unauthorized` cuja mensagem e serialização não contêm o token → T-03
- Três requisições simultâneas com cache vazio ou vencido → uma única chamada ao GitHub; `CHANGELOG_CACHE_TTL_SECONDS=0` → busca a cada requisição → T-04
- Tela de início e página Novidades abertas na mesma sessão, ou as duas pedindo ao mesmo tempo → uma chamada a `/changelog`; após erro, "Tentar novamente" volta a `ready` e `ensureLoaded()` busca de novo → T-07

## Critérios gerais de aceite
- `GET /changelog` com JWT e sem `GITHUB_REPO` responde 200 `{ configured: false, repository: null, items: [], fetchedAt: null, stale: false }`; sem JWT responde 401.
- Falha do GitHub sem cache responde 502 com `code: 'CHANGELOG_SOURCE_UNAVAILABLE'` e mensagem sem o token.
- Usuário sem nenhuma permissão vê o item "Novidades" no menu, e a página mostra os grupos "Novas funcionalidades", "Correções" e "Melhorias" com título sem prefixo, escopo, data do merge e `#número` que abre o PR (ou copia o link se a abertura falhar).
- A tela de início mostra o card "Novidades recentes" com até 5 itens (ícone do tipo, título sem prefixo, data) e "Ver todas" leva a `/home/changelog`, para qualquer usuário logado.
- `npm test`, `npm run test:e2e`, `npx tsc --noEmit`, `npx eslint` (backend) e `fvm flutter analyze`, `fvm flutter test` (frontend) sem linha nova em relação ao baseline; nenhum arquivo em `backend/prisma/` alterado.
