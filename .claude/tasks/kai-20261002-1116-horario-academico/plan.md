# Plano: Horário acadêmico semanal (backend)

## Objetivo
Criar no backend o horário semanal por turma, ligado ao calendário acadêmico: horário semanal (período) → dias → aulas (disciplina, hora de início e fim), com situação, registro de conteúdo/frequência por aula, edição, exclusão e replicação para outros períodos. Semana sempre segunda a domingo; o calendário aplicável decide em que dia há aula; sábado letivo sem aula bloqueia o salvamento; a replicação sobrescreve semanas ocupadas preservando aulas registradas. Execução sem commits. Inclui o CRUD mínimo de turmas (`school_class`) e disciplinas (`subject`).

## Premissas
- Escopo só `backend/` (NestJS + mysql2 + MySQL); frontend fora, inclusive o espelho de permissões.
- Base verificada: o calendário acadêmico (migration `0004_academic_calendar.sql`, módulos `schools` e `academic-calendar`) já está commitado em `main` (`206bc5d`, merge da PR #5). A sessão está em `task/horario-de-aula`, no mesmo commit de `main`, com a árvore limpa salvo esta pasta.
- **Execução sem commits (decisão do usuário):** nenhum agente (implementador, validador, revisor, fechador) roda `git add`, `git commit`, `git reset`, `git stash`, `git checkout` nem `git restore`. O trabalho fica no working tree de `task/horario-de-aula`. A prova de TDD é a evidência no relatório (`reports/T-XX.md § RED`: comando e saída do teste falhando **antes** da implementação, depois a saída passando); o escopo é conferido pelo working tree (`git status --porcelain` e `git diff 206bc5d`) contra os "Arquivos prováveis" exclusivos de cada task. O fechador só atualiza os artefatos de `.claude/tasks/` e não commita.
- Permissão: todas as rotas de `/subjects`, `/school-classes` e `/weekly-schedules` (leitura e escrita) exigem `@RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)` e `@TenantScoped()`, como `/schools` e `/academic-calendars`. Permissão nova exigiria seed, perfis default e espelho no frontend (fora do escopo).
- Turma (`school_class`): pertence a uma escola não excluída do tenant e a um ano letivo (`schoolYear`); nome único por `(tenant, escola, ano)` inclusive entre excluídas (409 `SCHOOL_CLASS_NAME_TAKEN`); `schoolId` e `schoolYear` imutáveis após criar (PATCH só `name`, `active`); exclusão lógica.
- Disciplina (`subject`): por tenant, `name` único inclusive entre excluídas (409 `SUBJECT_NAME_TAKEN`), `active`, exclusão lógica — espelho do cadastro de escolas.
- Período do horário semanal (decisão do usuário): **sempre segunda a domingo** (ex.: `2026-09-28` a `2026-10-04`). `startDate` tem de ser segunda e `endDate = startDate + 6`; a semana tem de tocar o `schoolYear` da turma (`startDate` ou `endDate` no ano); fora disso 400 `SCHEDULE_INVALID_PERIOD`. A semana do horário é imutável depois de criada (o PUT só troca os dias).
- Uma semana por turma: como toda semana começa na segunda, sobreposição = mesma `startDate`. Criar horário numa semana em que a turma já tem horário não excluído → 409 `SCHEDULE_WEEK_TAKEN` (checagem no service por `findByWeeks`, sem trava no banco; ver Riscos em `notes.md`). Na replicação a semana ocupada é sobrescrita (abaixo).
- Estrutura: o horário materializa um dia por data do período (`weekly_schedule_day`), cada dia com zero ou mais aulas (`weekly_schedule_lesson`: disciplina, `startTime`/`endTime` `HH:mm`). Aula com `startTime >= endTime` → 400 `SCHEDULE_LESSON_INVALID_TIME`; aulas que se cruzam no mesmo dia → 400 `SCHEDULE_LESSON_OVERLAP` (aula que termina 08:20 e outra que começa 08:20 não se cruzam). Disciplina inexistente/excluída/de outro tenant → 400 `SCHEDULE_SUBJECTS_INVALID`.
- Calendário aplicável, por data: entre os calendários não excluídos do tenant que têm o dia em `academic_calendar_day`, o vinculado à escola da turma (`academic_calendar_school`) prevalece sobre o geral (`all_schools = 1`); empate entre calendários do mesmo nível → menor `calendarId`. Data da semana sem calendário (ex.: semana em que o ano letivo começa ou termina) fica fora do calendário: `calendarId: null`, `dayType: null`, `hasClass: false`, e não aceita aula. Semana inteira sem calendário → 400 `SCHEDULE_CALENDAR_NOT_FOUND`. Consequência necessária da semana fixa segunda–domingo: sem isso, a primeira e a última semana do ano letivo seriam impossíveis.
- "Determina se vai ter aula" (confirmado pelo usuário): dia com aula (`hasClass: true`) somente se o tipo do calendário aplicável é `SCHOOL_DAY`. Na criação e na edição, aula num dia que não é `SCHOOL_DAY` (ou fora do calendário) é **rejeitada** (400 `SCHEDULE_LESSON_ON_NON_SCHOOL_DAY`). Na replicação, as aulas que cairiam em dia não letivo da semana alvo são **descartadas** e listadas em `discarded` com `reason: 'NON_SCHOOL_DAY'`.
- Sábado `SCHOOL_DAY` no calendário aplicável sem nenhuma aula → 400 `SCHEDULE_SATURDAY_WITHOUT_LESSONS` (decisão 4 do usuário), na criação, na edição e na replicação — nesta, sobre o resultado final de cada semana alvo (replicadas + registradas preservadas) —, nada gravado. Dias úteis letivos sem aula são permitidos.
- Registro (decisão 3): **por aula** — cada aula tem `contentRecorded` e `attendanceRecorded` (boolean, default `false`), alterados por `PATCH /weekly-schedules/:id/lessons/:lessonId/record`; o horário expõe o resumo `record: { lessons, contentRecorded, attendanceRecorded }` (contagens). Por aula porque o diário de classe registra conteúdo e frequência por aula, e os resumos por dia/semana derivam disso; o inverso não.
- Proteção do registro (confirmado): edição que remove ou altera (data, início, fim ou disciplina) uma aula com algum registro `true` → 409 `SCHEDULE_HAS_RECORDS`; aula idêntica por `(date, startTime, endTime, subjectId)` mantém as flags. Excluir horário com alguma aula registrada → 409 `SCHEDULE_HAS_RECORDS`. Edição e replicação regravam os dias: os `id` das aulas mudam; as flags são preservadas pelas regras acima.
- Situação (confirmado): `status` calculado na leitura — `UP_TO_DATE` quando o tipo de cada dia gravado no horário com calendário (instantâneo do último salvamento, `weekly_schedule_day.calendar_id` + `day_type`) é igual ao tipo atual daquele dia no mesmo calendário e o calendário não foi excluído; senão `OUTDATED`. Dia gravado fora do calendário (`calendar_id NULL`) não conta. `updatedAt` acompanha o último salvamento; PUT e replicação recalculam os instantâneos.
- Edição: `PUT /weekly-schedules/:id` substitui os dias inteiros (turma e semana imutáveis); exclusão lógica (`deleted_at`).
- Replicação (decisão do usuário): `POST /weekly-schedules/:id/replicate` com `targetStartDates` (1 a 20 segundas distintas, diferentes da semana de origem; senão 400 `SCHEDULE_INVALID_PERIOD`); cada alvo é a semana segunda–domingo; aulas copiadas por dia da semana; calendário recalculado por data do alvo; flags das aulas copiadas nascem `false`. Semana alvo **sem** horário da turma → horário criado (`action: 'CREATED'`). Semana alvo **com** horário → **sobrescrito** (`action: 'OVERWRITTEN'`): as aulas não registradas do horário existente saem; as aulas com `contentRecorded` ou `attendanceRecorded` `true` ficam com as flags.
- Colisão na sobrescrita: aula replicada cujo horário se cruza com uma aula registrada preservada do mesmo dia (`a.startTime < b.endTime && b.startTime < a.endTime`) é **descartada** e listada em `discarded` com `reason: 'RECORDED_CONFLICT'` — a registrada fica; aula replicada idêntica à registrada (mesma disciplina, início e fim) é absorvida sem entrar em `discarded`. A resposta, por semana alvo, traz `preserved` (aulas registradas mantidas) e `discarded` (`NON_SCHOOL_DAY` ou `RECORDED_CONFLICT`).
- Replicação tudo ou nada: qualquer violação de regra em qualquer semana alvo (sábado letivo sem aula no resultado, semana sem calendário, disciplina da origem excluída) → o erro da regra e nada gravado; criações e sobrescritas numa única transação.
- Datas como texto `YYYY-MM-DD` (`DATE_FORMAT`) e horas como `HH:mm` (`TIME_FORMAT(..., '%H:%i')`), como no calendário.

## Escopo

### Incluso
- Migration `0005_weekly_schedule.sql`: tabelas `subject`, `school_class`, `weekly_schedule`, `weekly_schedule_day`, `weekly_schedule_lesson`.
- Códigos de erro novos em `error-codes.ts` (disciplinas, turmas, horário).
- Regras puras do horário (período, aulas, calendário aplicável, sábado letivo, replicação, preservação de registros).
- Módulo `subjects`: CRUD mínimo de disciplinas (`/subjects`).
- Módulo `school-classes`: CRUD mínimo de turmas (`/school-classes`).
- Módulo `weekly-schedules`: repositório SQL, service, DTOs, controller e module (listar, detalhar, criar, editar, excluir, replicar com sobrescrita preservando aulas registradas, registrar conteúdo/frequência da aula).
- Registro dos três módulos em `app.module.ts` e e2e de permissão.

### Excluído
- Frontend (Flutter) e espelho de permissões.
- Permissões novas, seed e perfis default.
- Cadastro de alunos, professores e lançamento de conteúdo/frequência em si (só as flags).
- Notificação assíncrona (e-mail, push) do sábado letivo sem aula: a regra bloqueia o salvamento.
- Alteração do módulo de calendário acadêmico (`academic-calendar`) e de escolas (`schools`).
- Commits: a execução não commita nada (decisão do usuário).
- Trava de exclusão de turma ou disciplina em uso por horário.

## Contexto técnico
- Camadas envolvidas: database, backend
- Projeto/base analisada: `/home/kaine/source/geduc-rag` (raiz do repositório; código em `backend/`)
- Integrações: nenhuma (o horário lê as tabelas do calendário por SQL no próprio repositório)

## Baseline
- nenhuma

`npx tsc --noEmit` e `npx eslint "{src,test}/**/*.ts"` (sem `--fix`) rodaram em `backend/` em 2026-10-02 com exit 0 e 0 linhas de saída. Critério que usa tsc/eslint exige exit 0 e saída vazia.

## Exploração read-only
- Caminhos relevantes: `backend/src/modules/schools/**` (molde do CRUD mínimo), `backend/src/modules/academic-calendar/**` (`academic-calendar.rules.ts`: `DayType`, `DatePeriod`, `weekdayOf`; repositório com `DATE_FORMAT`, `VALUES ?` em lote, `findExistingSchoolIds`; `academic-calendar-list.query.ts` com `all_schools = 1 OR EXISTS (... academic_calendar_school ...)`), `backend/src/common/errors/error-codes.ts`, `backend/src/common/rbac/permissions.ts`, `backend/src/common/tenancy/tenant-scoped.decorator.ts`, `backend/src/common/dto/{pagination.dto,partial-type.options}.ts`, `backend/src/@core/application/adapters/database-connection.interface.ts`, `backend/src/@core/infra/database/query-builder/`, `backend/database/migrations/0004_academic_calendar.sql`, `backend/src/app.module.ts`, `backend/test/app.e2e-spec.ts`.
- Padrões identificados: módulo de plataforma com `application/interface/repository/*.interface.ts` (token string + records + inputs), `infra/database/repositories/*.repository.ts` (classe sem `@Injectable`, `IDatabaseConnection` no construtor, SQL em constantes, `runInTransaction`), `infra/database/queries/*-list.query.ts` (`createFilterContext`/`addEq`/`addRaw` + `buildPagedSelect`), DTOs class-validator + `@ApiProperty`, `PartialType(..., UPDATE_DTO_PARTIAL_OPTS)`, `PaginationQueryDto`; service `@Injectable` com `@Inject(TOKEN)`; module com `useFactory` + `inject: [DATABASE_CONNECTION]`, sem `exports`; erros `new XException({ code: ERROR_CODES.X, message })`; specs de repositório com conexão falsa (`makeConnection`) e de service com repositório `jest.Mocked`; e2e com `DATABASE_CONNECTION` stubado (só wiring 401/403/400). Migrations: `id` `VARCHAR(191)` (UUID), `DATETIME(3)`, `deleted_at` + `*_by_id`, utf8mb4_unicode_ci, nomes `<tabela>_<cols>_key|_idx|_fkey`.
- Scripts úteis: em `backend/` — `npx jest <caminho>`, `npx jest`, `npm run test:e2e`, `npx tsc --noEmit`, `npx eslint "{src,test}/**/*.ts"`, `npm run db:migrate` (só banco local; runner com checksum em `schema_migrations`). MySQL de dev: `docker compose -f infra/db/docker-compose.yml up -d` (porta 3307, banco `geduc_rag`, usuário/senha `rag`).
- Riscos identificados: `app.module.ts`, `error-codes.ts` e `test/app.e2e-spec.ts` são globais (um escritor cada); `AcademicCalendarModule` não exporta nada (o horário lê o calendário por SQL próprio); não há unique `(tenant, school_year)` em calendário (vários calendários podem casar com a mesma escola/data: regra de precedência + desempate por id); coluna `TIME` volta como `HH:MM:SS` (usar `TIME_FORMAT`); `DATE` lida como `Date` desloca o dia (usar `DATE_FORMAT`); hooks `protect-migrations.sh` (confirmação ao criar a migration), `format-file.sh` (`eslint --fix` no arquivo editado) e `check-complexity.sh` (complexidade ciclomática no Stop); `npm run lint`/`npm run format` reescrevem o repositório inteiro; `stash@{0}` com WIP de frontend do usuário (não tocar).

## Mapa de arquivos

| Arquivo | Responsabilidade | Ação | Tasks que tocam |
|---|---|---|---|
| `backend/database/migrations/0005_weekly_schedule.sql` | Schema de `subject`, `school_class`, `weekly_schedule`, `weekly_schedule_day`, `weekly_schedule_lesson` | criar | T-01 |
| `backend/src/common/errors/error-codes.ts` | Códigos `SUBJECT_*`, `SCHOOL_CLASS_*` e `SCHEDULE_*` | modificar | T-02 |
| `backend/src/modules/weekly-schedules/weekly-schedule.rules.ts` | Regras puras do horário (semana segunda–domingo, aulas, calendário aplicável, sábado, replicação com sobrescrita, registros) | criar | T-02 |
| `backend/src/modules/weekly-schedules/__tests__/weekly-schedule.rules.spec.ts` | Specs das regras puras | criar | T-02 |
| `backend/src/modules/subjects/application/interface/repository/subject.repository.interface.ts` | Token, records e inputs do repositório de disciplinas | criar | T-03 |
| `backend/src/modules/subjects/infra/database/repositories/subject.repository.ts` | `ISubjectRepository` em SQL | criar | T-03 |
| `backend/src/modules/subjects/infra/database/queries/subject-list.query.ts` | Página e contagem da listagem de disciplinas | criar | T-03 |
| `backend/src/modules/subjects/dto/subject.dto.ts` | DTOs de disciplina | criar | T-03 |
| `backend/src/modules/subjects/subjects.service.ts` | Regras do cadastro de disciplinas | criar | T-03 |
| `backend/src/modules/subjects/subjects.controller.ts` | Rotas `/subjects` | criar | T-03 |
| `backend/src/modules/subjects/subjects.module.ts` | Wiring do módulo de disciplinas | criar | T-03 |
| `backend/src/modules/subjects/__tests__/subject.repository.spec.ts` | Spec do repositório de disciplinas | criar | T-03 |
| `backend/src/modules/subjects/__tests__/subjects.service.spec.ts` | Spec do service de disciplinas | criar | T-03 |
| `backend/src/modules/school-classes/application/interface/repository/school-class.repository.interface.ts` | Token, records e inputs do repositório de turmas | criar | T-04 |
| `backend/src/modules/school-classes/infra/database/repositories/school-class.repository.ts` | `ISchoolClassRepository` em SQL | criar | T-04 |
| `backend/src/modules/school-classes/infra/database/queries/school-class-list.query.ts` | Página e contagem da listagem de turmas | criar | T-04 |
| `backend/src/modules/school-classes/dto/school-class.dto.ts` | DTOs de turma | criar | T-04 |
| `backend/src/modules/school-classes/school-classes.service.ts` | Regras do cadastro de turmas | criar | T-04 |
| `backend/src/modules/school-classes/school-classes.controller.ts` | Rotas `/school-classes` | criar | T-04 |
| `backend/src/modules/school-classes/school-classes.module.ts` | Wiring do módulo de turmas | criar | T-04 |
| `backend/src/modules/school-classes/__tests__/school-class.repository.spec.ts` | Spec do repositório de turmas | criar | T-04 |
| `backend/src/modules/school-classes/__tests__/school-classes.service.spec.ts` | Spec do service de turmas | criar | T-04 |
| `backend/src/modules/weekly-schedules/application/interface/repository/weekly-schedule.repository.interface.ts` | Token, records e inputs do repositório do horário | criar | T-05 |
| `backend/src/modules/weekly-schedules/infra/database/repositories/weekly-schedule.repository.ts` | `IWeeklyScheduleRepository` em SQL (horário, dias, aulas, calendário aplicável, situação, escrita em lote `saveWeeks`) | criar | T-05 |
| `backend/src/modules/weekly-schedules/infra/database/queries/weekly-schedule-list.query.ts` | Página e contagem da listagem de horários | criar | T-05 |
| `backend/src/modules/weekly-schedules/__tests__/weekly-schedule.repository.spec.ts` | Spec do repositório do horário | criar | T-05 |
| `backend/src/modules/weekly-schedules/dto/weekly-schedule.dto.ts` | DTOs do horário, dias, aulas, replicação e registro | criar | T-06 |
| `backend/src/modules/weekly-schedules/weekly-schedules.service.ts` | Regras de criação, edição, exclusão, replicação e registro | criar | T-06 |
| `backend/src/modules/weekly-schedules/weekly-schedules.controller.ts` | Rotas `/weekly-schedules` | criar | T-06 |
| `backend/src/modules/weekly-schedules/weekly-schedules.module.ts` | Wiring do módulo do horário | criar | T-06 |
| `backend/src/modules/weekly-schedules/__tests__/weekly-schedules.service.spec.ts` | Spec do service do horário | criar | T-06 |
| `backend/src/app.module.ts` | Registro de `SubjectsModule`, `SchoolClassesModule` e `WeeklySchedulesModule` | modificar | T-07 |
| `backend/test/app.e2e-spec.ts` | e2e de permissão das rotas novas | modificar | T-07 |

Nenhum arquivo é tocado por mais de uma task. Os arquivos globais (`error-codes.ts`, `app.module.ts`, `app.e2e-spec.ts`) têm escritor único (T-02 e T-07); os módulos novos não são registrados antes de T-07.

## Decisões de arquitetura

| Decisão | Alternativas consideradas | Motivo da escolha |
|---|---|---|
| Três módulos de plataforma (`subjects`, `school-classes`, `weekly-schedules`) no padrão de `schools` | Um módulo só; Clean Architecture do RAG | `backend/CLAUDE.md` separa as famílias; turma e disciplina são cadastros reutilizáveis |
| O horário lê turma, disciplinas e calendário por SQL no próprio repositório | Exportar `AcademicCalendarService`/serviços de turma e disciplina e importar os módulos | Mesmo precedente do calendário (`findExistingSchoolIds`): sem acoplamento entre módulos nem alteração de `academic-calendar` |
| Calendário aplicável resolvido por data (candidatos numa só query, escolha na regra pura `resolveCalendarDays`) | Resolver um calendário por ano no SQL | Uma query para qualquer número de datas (replicação sem N+1); precedência testável isoladamente |
| Dia materializado com instantâneo `calendar_id` + `day_type` | Calcular tudo na leitura | Situação `UP_TO_DATE`/`OUTDATED` vira um `EXISTS` comparando instantâneo × calendário atual, na listagem e no detalhe |
| Registro de conteúdo/frequência por aula (flags) | Por dia; por horário | Granularidade do diário de classe; resumo por horário deriva das aulas |
| Aula em dia não letivo: rejeitar na criação/edição, descartar na replicação | Ignorar sempre; rejeitar sempre | Confirmado pelo usuário: criação explícita não perde dado em silêncio; replicação atravessa feriados |
| Semana fixa segunda–domingo; dia sem calendário = fora do calendário (sem aula), erro só se a semana inteira não tem calendário | Período livre; exigir calendário em todos os dias | Decisão do usuário sobre a semana; a primeira e a última semana do ano letivo ficariam impossíveis com a exigência total |
| Replicação sobrescreve a semana ocupada preservando aulas registradas; replicada que colide com registrada é descartada e listada | 409 em conflito; pular a semana | Decisão do usuário; nenhum registro de conteúdo/frequência se perde e a resposta mostra o que ficou de fora |
| Uma única escrita `saveWeeks({ creates, replaces })` numa transação, em lote (`VALUES ?`, `IN (?)`) | `createMany` + `replace` por horário | Replicação mista (cria e sobrescreve) tudo-ou-nada, sem N+1, com número fixo de comandos SQL |
| Regras puras em `weekly-schedule.rules.ts` importando `DayType`, `DatePeriod`, `weekdayOf` de `academic-calendar.rules.ts` | Duplicar tipos e cálculo de dia da semana | Fonte única dos tipos de dia; import de arquivo puro não cria dependência de módulo Nest |

## Diagrama de dependências

```text
T-01 ─┬─> T-03 ─────────────┐
      ├─> T-04 ─────────────┤
      └─> T-05 ─> T-06 ─────┴─> T-07
T-02 ─┬─> T-03, T-04, T-05
      └─> T-06
```

## Estratégia de execução
- Branch de trabalho: `task/horario-de-aula`
- Observação: é a branch atual, por decisão do usuário; não criar outra.
- Branch base: `main`
- Commits da onda: **nenhum** — execução sem commits por decisão do usuário. Ninguém roda `git add`, `git commit`, `git reset`, `git stash`, `git checkout` ou `git restore`. TDD comprovado pela evidência em `reports/T-XX.md § RED` (saída falhando antes da implementação, depois passando); escopo conferido pelo working tree (`git status --porcelain`, `git diff 206bc5d -- <caminhos>` e arquivos não rastreados) contra os "Arquivos prováveis" exclusivos de cada task. BASE de todas as ondas = `206bc5d`. O fechador só atualiza `tasks.md`, `notes.md` e `eficiencia/` em `.claude/tasks/` e não commita (sem `new-commit`, sem `chore(tasks)`).
- Isolamento em ondas com edições paralelas: caminho exclusivo (Onda 1 com duas tasks e Onda 2 com três, todas de arquivos disjuntos no working tree compartilhado e sem commits; Ondas 3 e 4 com escritor único)

## Ondas de execução

### Onda 1
- T-01 — migration (base de schema)
- T-02 — códigos de erro + regras puras do horário (contrato de tipos)

### Onda 2
- T-03 — módulo de disciplinas (`/subjects`)
- T-04 — módulo de turmas (`/school-classes`)
- T-05 — repositório do horário semanal

### Onda 3
- T-06 — service, DTOs, controller e module do horário semanal (`/weekly-schedules`)

### Onda 4
- T-07 — registro em `app.module.ts`, e2e e validação integral

## Agentes

| Agente | subagent_type | model | Tasks |
|---|---|---|---|
| Sun Tzu — orquestrador | — | — | todas |
| Athena | general-purpose | inherit | T-01 |
| Arquimedes | general-purpose | inherit | T-02 |
| Levi | general-purpose | inherit | T-03 |
| Platão | general-purpose | inherit | T-04 |
| Saitama | general-purpose | inherit | T-05 |
| Jaspion | general-purpose | inherit | T-06 |
| Aang | general-purpose | inherit | T-07 |

## Review Focus
- `POST /weekly-schedules` de turma cuja escola tem calendário próprio com `2026-10-03` (sábado) `SCHOOL_DAY` enquanto o calendário geral tem o mesmo sábado `NON_SCHOOL_DAY`, sem aula no sábado → 400 `SCHEDULE_SATURDAY_WITHOUT_LESSONS` (calendário da escola prevalece), `saveWeeks` não é chamado → T-06
- `POST /weekly-schedules/:id/replicate` para `2026-10-19`, onde a turma já tem horário com aula registrada `08:20–09:10` (`attendanceRecorded: true`), e origem com aula `08:00–08:50` na segunda → semana `OVERWRITTEN`, registrada preservada com as flags, replicada em `discarded` com `RECORDED_CONFLICT`, aulas não registradas antigas removidas → T-06
- Semana `2026-12-14`–`2026-12-20` com o calendário terminando em `2026-12-18` (sexta) → `2026-12-19` e `2026-12-20` com `dayType: null`, `hasClass: false`, sem erro; aula em `2026-12-19` → 400 `SCHEDULE_LESSON_ON_NON_SCHOOL_DAY` → T-02
- Dia do calendário alterado depois de salvar o horário (segunda passa de `SCHOOL_DAY` a `NON_SCHOOL_DAY`) → `status: 'OUTDATED'` na listagem e no detalhe (SQL compara `wd.day_type` com o `cd.day_type` atual, só em dia com `wd.calendar_id IS NOT NULL`) → T-05

## Critérios gerais de aceite
- `npx jest` em `backend/` termina com `Tests:` sem nenhuma linha `failed` e com as suítes novas (`weekly-schedule.rules`, `subject.repository`, `subjects.service`, `school-class.repository`, `school-classes.service`, `weekly-schedule.repository`, `weekly-schedules.service`) listadas como `PASS`.
- `npm run test:e2e` em `backend/` com `Tests:` sem `failed`, incluindo os casos de 403 das rotas novas.
- `npx tsc --noEmit` e `npx eslint "{src,test}/**/*.ts"` em `backend/` com exit 0 e saída vazia.
- Nenhum commit novo na branch: `git log --oneline -1` continua `206bc5d` e o trabalho aparece só em `git status --porcelain`, dentro dos caminhos do Mapa de arquivos.
- `npm run db:migrate` em banco local imprime `applied: 0005_weekly_schedule` e as contagens de `tenant`, `user`, `school`, `academic_calendar` e `academic_calendar_day` são iguais antes e depois.
- Toda rota de `/subjects`, `/school-classes` e `/weekly-schedules` exige `employee:manage` e `tenant-id` (403 `FORBIDDEN_PERMISSION` sem a permissão).
