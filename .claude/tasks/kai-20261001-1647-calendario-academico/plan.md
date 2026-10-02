# Plano: Calendário acadêmico (backend)

## Objetivo
Criar no backend o módulo de calendário acadêmico por tenant: um calendário é um ano letivo (ano, início, fim) atribuído a escolas específicas ou a todas, com os dias gerados no intervalo e tipados (5 tipos), consultas por dia, semana, mês e ano e quantitativos por tipo. Inclui o cadastro mínimo de escolas (`school`) por tenant.

## Premissas
- Escopo só `backend/`; frontend fora (inclusive o espelho `frontend/lib/core/auth/app_permissions.dart`, que não muda: nenhuma permissão nova).
- Permissão: "quem pode criar funcionários" = `PERMISSIONS.EMPLOYEE_MANAGE` (`employee:manage`, rota `POST /employees`). Todas as rotas de `/academic-calendars` e `/schools` (leitura e escrita) exigem `@RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)`. Não existe permissão de escola no catálogo; criar `school:*` exigiria seed, perfis default e espelho no frontend — fora do escopo pedido.
- `@TenantScoped()` em ambos os controllers, como `EmployeesController`; tenant sempre de `@TenantId()`.
- Tipos de dia (valor gravado → rótulo): `SCHOOL_DAY` (Dia Letivo), `NON_SCHOOL_DAY` (Dia não Letivo), `OPTIONAL_DAY` (Ponto facultativo), `LESSON_PLANNING` (Planejamento de aula), `TEACHER_TRAINING` (Formação Pedagógica).
- Geração: domingo e sábado nascem `NON_SCHOOL_DAY`; segunda a sexta nascem `SCHOOL_DAY`. Sábado e dias úteis aceitam qualquer um dos 5 tipos depois.
- Domingo é imutável: `type` diferente de `NON_SCHOOL_DAY` num domingo → 400 `CALENDAR_SUNDAY_IMMUTABLE`; `type: 'NON_SCHOOL_DAY'` no domingo é aceito como no-op; `description` é sempre editável.
- Intervalo: `startDate <= endDate` e as duas datas dentro do `year` do calendário (no máximo 366 dias); fora disso → 400 `CALENDAR_INVALID_RANGE`.
- `year`, `startDate` e `endDate` são imutáveis após a criação (PATCH do calendário só altera `name`, `allSchools`, `schoolIds`); mudar o intervalo = excluir e recriar.
- Escolas do calendário: `allSchools: true` exige `schoolIds` vazio/ausente; `allSchools: false` exige ao menos um `schoolId`; todo id precisa ser escola não excluída do tenant → senão 400 `CALENDAR_SCHOOLS_INVALID`.
- Visões: `day` = a data; `week` = domingo a sábado da semana da data; `month` = mês civil; `year` = ano civil. Quantitativos da visão = contagem por tipo dos dias do calendário dentro do período; do calendário inteiro = `totals` do detalhe (`GET /academic-calendars/:id`).
- Datas trafegam e são lidas como texto `YYYY-MM-DD` (SQL `DATE_FORMAT(..., '%Y-%m-%d')`), nunca como `Date`, para não sofrer fuso.
- Escola: CRUD mínimo (`name`, `active`), exclusão lógica; nome único por tenant inclusive entre excluídas (409 `SCHOOL_NAME_TAKEN`), como e-mail/CPF de `employee`. Escola excluída some do `schoolIds` dos calendários (o vínculo fica na tabela).
- Sem trava de sobreposição entre calendários do mesmo ano/escola (não pedida).

## Escopo

### Incluso
- Migration `0004_academic_calendar.sql`: tabelas `school`, `academic_calendar`, `academic_calendar_school`, `academic_calendar_day`.
- Códigos de erro novos em `error-codes.ts`.
- Regras puras do calendário (tipos de dia, padrão por dia da semana, geração dos dias, período da visão, quantitativos, imutabilidade do domingo).
- Módulo `schools`: repositório SQL, service, DTOs, controller e module (listar, detalhar, criar, editar, excluir logicamente).
- Módulo `academic-calendar`: repositório SQL, service, DTOs, controller e module (CRUD do calendário, consulta de dias por visão com quantitativos, edição de tipo/descrição do dia).
- Registro dos dois módulos em `app.module.ts` e e2e de permissão.

### Excluído
- Frontend (Flutter) e espelho de permissões.
- Permissões novas, seed e perfis default.
- Feriados automáticos, importação de calendário, trava de sobreposição entre calendários.
- Alteração de `year`/`startDate`/`endDate` de calendário existente.

## Contexto técnico
- Camadas envolvidas: database, backend
- Projeto/base analisada: `/home/kaine/source/geduc-rag` (raiz do repositório; código em `backend/`)
- Integrações: nenhuma

## Baseline
- nenhuma

`npx tsc --noEmit` e `npx eslint "{src,test}/**/*.ts"` (sem `--fix`) rodaram em `backend/` em 2026-10-01 com exit 0 e 0 linhas de saída; `npx jest` (46 suítes, 377 testes) e `npm run test:e2e` (18 testes) passam. Critério que usa tsc/eslint exige exit 0 e saída vazia.

## Exploração read-only
- Caminhos relevantes: `backend/src/modules/employees/**` (padrão a copiar), `backend/src/common/rbac/permissions.ts`, `backend/src/common/errors/error-codes.ts`, `backend/src/common/tenancy/tenant-scoped.decorator.ts`, `backend/src/@core/application/adapters/database-connection.interface.ts`, `backend/src/@core/infra/database/query-builder/{filters,paged-select}.ts`, `backend/src/@core/infra/adapters/mysql.adapter.ts`, `backend/database/migrations/0003_employee.sql`, `backend/src/app.module.ts`, `backend/test/app.e2e-spec.ts`, `backend/src/modules/users/users.policy.ts` (regras puras que lançam `HttpException`).
- Padrões identificados: módulo de plataforma com `application/interface/repository/*.interface.ts` (token string + records + inputs), `infra/database/repositories/*.repository.ts` (classe sem `@Injectable`, `IDatabaseConnection` no construtor, SQL em constantes, allow-list de colunas no UPDATE, `runInTransaction` + `findOrThrow`), `infra/database/queries/*-list.query.ts` (`createFilterContext`/`addRaw`/`addEq`/`addLike` + `buildPagedSelect`), `dto/*.dto.ts` (class-validator + `@ApiProperty`, `PartialType(..., UPDATE_DTO_PARTIAL_OPTS)`, `PaginationQueryDto`), service `@Injectable` com `@Inject(TOKEN)`, module com `useFactory` + `inject: [DATABASE_CONNECTION]`; specs com conexão falsa que registra SQL (`makeConnection`) e repositório `jest.Mocked`. O adapter mysql2 usa `query` (protocolo texto): `IN (?)` com array e `VALUES ?` em lote funcionam; sessão em UTC e `dateStrings: false`.
- Scripts úteis: em `backend/` — `npx jest <caminho>`, `npx jest`, `npm run test:e2e`, `npx tsc --noEmit`, `npx eslint "{src,test}/**/*.ts"`, `npm run db:migrate` (só banco local, imprime `db:migrate em <host>`). MySQL de dev: `docker compose -f infra/db/docker-compose.yml up -d` (porta 3307).
- Riscos identificados: `app.module.ts` e `error-codes.ts` são globais (um escritor cada); coluna `DATE` lida como `Date` desloca o dia por fuso (mitigado com `DATE_FORMAT`); `date`/`year` como nome de coluna (evitados: `day_date`, `school_year`); hooks `protect-migrations.sh` (confirmação ao criar a migration) e `format-file.sh` (`eslint --fix` automático no arquivo editado); `npm run lint`/`npm run format` reescrevem o repositório inteiro.

## Mapa de arquivos

| Arquivo | Responsabilidade | Ação | Tasks que tocam |
|---|---|---|---|
| `backend/database/migrations/0004_academic_calendar.sql` | Schema de `school`, `academic_calendar`, `academic_calendar_school`, `academic_calendar_day` | criar | T-01 |
| `backend/src/common/errors/error-codes.ts` | Códigos `SCHOOL_*` e `CALENDAR_*` | modificar | T-02 |
| `backend/src/modules/academic-calendar/academic-calendar.rules.ts` | Tipos de dia e regras puras (geração, período, quantitativos, domingo) | criar | T-02 |
| `backend/src/modules/academic-calendar/__tests__/academic-calendar.rules.spec.ts` | Specs das regras puras | criar | T-02 |
| `backend/src/modules/schools/application/interface/repository/school.repository.interface.ts` | Token, records e inputs do repositório de escolas | criar | T-03 |
| `backend/src/modules/schools/infra/database/repositories/school.repository.ts` | `ISchoolRepository` em SQL | criar | T-03 |
| `backend/src/modules/schools/infra/database/queries/school-list.query.ts` | Página e contagem da listagem de escolas | criar | T-03 |
| `backend/src/modules/schools/__tests__/school.repository.spec.ts` | Spec do repositório de escolas | criar | T-03 |
| `backend/src/modules/academic-calendar/application/interface/repository/academic-calendar.repository.interface.ts` | Token, records e inputs do repositório do calendário | criar | T-04 |
| `backend/src/modules/academic-calendar/infra/database/repositories/academic-calendar.repository.ts` | `IAcademicCalendarRepository` em SQL (calendário, vínculos, dias) | criar | T-04 |
| `backend/src/modules/academic-calendar/infra/database/queries/academic-calendar-list.query.ts` | Página e contagem da listagem de calendários | criar | T-04 |
| `backend/src/modules/academic-calendar/__tests__/academic-calendar.repository.spec.ts` | Spec do repositório do calendário | criar | T-04 |
| `backend/src/modules/schools/dto/school.dto.ts` | DTOs de escola | criar | T-05 |
| `backend/src/modules/schools/schools.service.ts` | Regras do cadastro de escolas | criar | T-05 |
| `backend/src/modules/schools/schools.controller.ts` | Rotas `/schools` | criar | T-05 |
| `backend/src/modules/schools/schools.module.ts` | Wiring do módulo de escolas | criar | T-05 |
| `backend/src/modules/schools/__tests__/schools.service.spec.ts` | Spec do service de escolas | criar | T-05 |
| `backend/src/modules/academic-calendar/dto/academic-calendar.dto.ts` | DTOs do calendário, dias e quantitativos | criar | T-06 |
| `backend/src/modules/academic-calendar/academic-calendar.service.ts` | Regras do calendário (criação, escolas, visões, edição do dia) | criar | T-06 |
| `backend/src/modules/academic-calendar/academic-calendar.controller.ts` | Rotas `/academic-calendars` | criar | T-06 |
| `backend/src/modules/academic-calendar/academic-calendar.module.ts` | Wiring do módulo do calendário | criar | T-06 |
| `backend/src/modules/academic-calendar/__tests__/academic-calendar.service.spec.ts` | Spec do service do calendário | criar | T-06 |
| `backend/src/app.module.ts` | Registro de `SchoolsModule` e `AcademicCalendarModule` | modificar | T-07 |
| `backend/test/app.e2e-spec.ts` | e2e de permissão das rotas novas | modificar | T-07 |

Nenhum arquivo é tocado por mais de uma task. Os arquivos globais (`error-codes.ts`, `app.module.ts`, `app.e2e-spec.ts`) têm escritor único (T-02 e T-07).

## Decisões de arquitetura

| Decisão | Alternativas consideradas | Motivo da escolha |
|---|---|---|
| Dois módulos de plataforma (`schools`, `academic-calendar`) no padrão de `employees` | Um módulo só; Clean Architecture do RAG | `backend/CLAUDE.md` separa as famílias; escola é cadastro reutilizável por outros módulos |
| Calendário valida escolas por SQL no próprio repositório (`findExistingSchoolIds`) | Importar `SchoolsModule`/`SchoolsService` | Sem acoplamento nem dependência circular entre módulos de plataforma |
| Dias materializados em `academic_calendar_day` (uma linha por dia, inserção em lote `VALUES ?`) | Guardar só exceções e calcular o resto | Quantitativos viram `GROUP BY`; edição de dia é `UPDATE` simples; até 366 linhas por calendário |
| Tipo de dia como `ENUM` no MySQL + `DAY_TYPES` no TypeScript | `VARCHAR` livre; tabela de tipos | Conjunto fechado pedido pelo usuário; o banco recusa valor fora da lista |
| Regras puras em `academic-calendar.rules.ts` (como `users.policy.ts`) | Regras dentro do service | Testáveis isoladamente; Onda 1 fixa o contrato consumido por repositório e service |
| Datas como texto `YYYY-MM-DD` ponta a ponta | `Date` do JS | `DATE` sem hora; evita deslocamento de fuso |
| Semana de domingo a sábado | Semana ISO (segunda a domingo) | Convenção dos calendários escolares brasileiros e começa pelo dia sempre não letivo |
| Totais do calendário inteiro no detalhe; da visão na consulta de dias | Endpoint `/summary` separado | Menos rotas; cada visão já devolve o próprio quantitativo |

## Diagrama de dependências

```text
T-01 ─┬─> T-03 ─> T-05 ─┐
      │                 ├─> T-07
T-02 ─┼─> T-04 ─> T-06 ─┘
      └──────────> T-05
```

## Estratégia de execução
- Branch de trabalho: `task/calendario-academico`
- Branch base: `main`
- Commits da onda: cada implementador commita os próprios caminhos (`git commit -- <caminhos>`); com `worktree por agente` eles chegam pelos merges de `wave<N>/T-XX`. O fechador usa a skill `new-commit --auto` só se sobrou algo sem commit e sempre registra o estado das tasks num `chore(tasks): registra commits da onda N`.
- Isolamento em ondas com edições paralelas: caminho exclusivo (Ondas 1–3 com duas tasks de arquivos disjuntos cada; Onda 4 com escritor único)

## Ondas de execução

### Onda 1
- T-01 — migration (base de schema)
- T-02 — códigos de erro + regras puras (contrato de tipos)

### Onda 2
- T-03 — repositório de escolas
- T-04 — repositório do calendário

### Onda 3
- T-05 — service/controller de escolas
- T-06 — service/controller do calendário

### Onda 4
- T-07 — registro em `app.module.ts`, e2e e validação integral

## Agentes

| Agente | subagent_type | model | Tasks |
|---|---|---|---|
| Sun Tzu — orquestrador | — | — | todas |
| Athena | general-purpose | inherit | T-01 |
| Arquimedes | general-purpose | inherit | T-02 |
| Levi | general-purpose | inherit | T-03 |
| Saitama | general-purpose | inherit | T-04 |
| Platão | general-purpose | inherit | T-05 |
| Jaspion | general-purpose | inherit | T-06 |
| Aang | general-purpose | inherit | T-07 |

## Review Focus
- `PATCH /academic-calendars/:id/days/2026-02-01` (domingo) com `{ "type": "SCHOOL_DAY" }` → 400 `CALENDAR_SUNDAY_IMMUTABLE` e a linha no banco segue `NON_SCHOOL_DAY` → T-06
- Dia lido do MySQL com sessão UTC e servidor em outro fuso → `date` sai `2026-02-01`, nunca `2026-01-31` (SQL com `DATE_FORMAT`) → T-04
- `POST /academic-calendars` com `allSchools: false` e um `schoolId` de escola excluída ou de outro tenant → 400 `CALENDAR_SCHOOLS_INVALID`, nada gravado → T-06
- `PATCH /academic-calendars/:id` com `allSchools: true` num calendário que tinha escolas → `schoolIds: []` na resposta e vínculos antigos removidos → T-06
- Escola excluída logicamente que estava vinculada → some do `schoolIds` do detalhe e da listagem filtrada por `schoolId` → T-04

## Critérios gerais de aceite
- `npx jest` em `backend/` termina com `Tests:` sem nenhuma linha `failed` e com as suítes novas (`academic-calendar.rules`, `school.repository`, `academic-calendar.repository`, `schools.service`, `academic-calendar.service`) listadas como `PASS`.
- `npm run test:e2e` em `backend/` com `Tests:` sem `failed`, incluindo os casos de 403 das rotas novas.
- `npx tsc --noEmit` e `npx eslint "{src,test}/**/*.ts"` em `backend/` com exit 0 e saída vazia.
- `npm run db:migrate` em banco local imprime `applied: 0004_academic_calendar` e as contagens de `tenant`, `user` e `employee` são iguais antes e depois.
- Toda rota de `/schools` e `/academic-calendars` exige `employee:manage` e `tenant-id` (403 `FORBIDDEN_PERMISSION` sem a permissão).
