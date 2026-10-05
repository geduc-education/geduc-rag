# Tasks

| ID | Camada | Descrição | Dependências | Paralelizável | Complexidade | Agente | Status |
|---|---|---|---|---|---|---|---|
| T-01 | database | Migration `0005_weekly_schedule.sql` (disciplina, turma, horário, dias, aulas) | — | sim | média | Athena | [x] |
| T-02 | backend | Códigos de erro novos + regras puras do horário (`weekly-schedule.rules.ts`) | — | sim | alta | Arquimedes | [x] |
| T-03 | backend | Módulo de disciplinas `/subjects` (repositório, service, DTOs, controller, module) | T-01, T-02 | sim | média | Levi | [x] |
| T-04 | backend | Módulo de turmas `/school-classes` (repositório, service, DTOs, controller, module) | T-01, T-02 | sim | média | Platão | [x] |
| T-05 | backend | Repositório SQL do horário semanal (horário, dias, aulas, calendário aplicável, situação, `saveWeeks` em lote) | T-01, T-02 | sim | alta | Saitama | [x] |
| T-06 | backend | Service, DTOs, controller e module do horário semanal (`/weekly-schedules`, replicação com sobrescrita) | T-02, T-05 | não | alta | Jaspion | [x] |
| T-07 | backend | Registro dos módulos em `app.module.ts`, e2e de permissão e validação integral | T-03, T-04, T-06 | não | simples | Aang | [x] |

## Detalhamento

### T-01 — Migration `0005_weekly_schedule.sql`

**Camada:** database
**Dependências:** nenhuma
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Athena

**Arquivos prováveis**
- `backend/database/migrations/0005_weekly_schedule.sql`

**Interface**
- Produz: `subject(id, tenant_id, name, active, created_at, updated_at, deleted_at, created_by_id, updated_by_id, deleted_by_id)` com `UNIQUE INDEX subject_tenant_id_name_key(tenant_id, name)` e `INDEX subject_tenant_id_active_idx(tenant_id, active)`
- Produz: `school_class(id, tenant_id, school_id, school_year, name, active, created_at, updated_at, deleted_at, created_by_id, updated_by_id, deleted_by_id)` — `school_year SMALLINT NOT NULL`, `UNIQUE INDEX school_class_tenant_id_school_id_school_year_name_key(tenant_id, school_id, school_year, name)`, `INDEX school_class_school_id_idx(school_id)`, FK `school_id` → `school(id)` `ON DELETE RESTRICT ON UPDATE CASCADE`
- Produz: `weekly_schedule(id, tenant_id, school_class_id, start_date, end_date, created_at, updated_at, deleted_at, created_by_id, updated_by_id, deleted_by_id)` — `start_date DATE NOT NULL`, `end_date DATE NOT NULL`, `INDEX weekly_schedule_tenant_id_school_class_id_start_date_idx(tenant_id, school_class_id, start_date)`, FK `school_class_id` → `school_class(id)` `ON DELETE RESTRICT`
- Produz: `weekly_schedule_day(id, tenant_id, schedule_id, day_date, calendar_id, day_type, created_at, updated_at)` — `day_date DATE NOT NULL`, `calendar_id VARCHAR(191) NULL` (FK → `academic_calendar(id)` `ON DELETE RESTRICT`; `NULL` = data fora de qualquer calendário), `day_type ENUM('SCHOOL_DAY','NON_SCHOOL_DAY','OPTIONAL_DAY','LESSON_PLANNING','TEACHER_TRAINING') NULL`, `UNIQUE INDEX weekly_schedule_day_schedule_id_day_date_key(schedule_id, day_date)`, `INDEX weekly_schedule_day_calendar_id_day_date_idx(calendar_id, day_date)`, FK `schedule_id` → `weekly_schedule(id)` `ON DELETE CASCADE` (filha pura)
- Produz: `weekly_schedule_lesson(id, tenant_id, schedule_day_id, subject_id, start_time, end_time, content_recorded, attendance_recorded, created_at, updated_at, updated_by_id)` — `start_time TIME NOT NULL`, `end_time TIME NOT NULL`, `content_recorded BOOLEAN NOT NULL DEFAULT false`, `attendance_recorded BOOLEAN NOT NULL DEFAULT false`, `INDEX weekly_schedule_lesson_schedule_day_id_start_time_idx(schedule_day_id, start_time)`, `INDEX weekly_schedule_lesson_subject_id_idx(subject_id)`, FK `schedule_day_id` → `weekly_schedule_day(id)` `ON DELETE CASCADE` (filha pura), FK `subject_id` → `subject(id)` `ON DELETE RESTRICT`
- Convenções (de `0004_academic_calendar.sql`): `id`/FKs `VARCHAR(191)`, `created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)`, `updated_at DATETIME(3) NOT NULL`, `deleted_at DATETIME(3) NULL`, `active BOOLEAN NOT NULL DEFAULT true`, `DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`; `tenant_id` → `tenant(id)` `ON DELETE RESTRICT ON UPDATE CASCADE`; `created_by_id`/`updated_by_id` → `user(id)` `ON DELETE SET NULL` (`deleted_by_id` sem FK, como em 0004). Constraints nomeadas `<tabela>_<coluna>_fkey`.
- Consome: nada

**Teste RED**
- sem teste: migration pura (DDL), validada por `npm run db:migrate` em banco local

**Critério de aceite**
- `npm run db:migrate` imprime `db:migrate em localhost` (ou `127.0.0.1`) e `applied: 0005_weekly_schedule`; uma segunda execução imprime `applied: (nenhuma)`.
- `SHOW TABLES` lista `subject`, `school_class`, `weekly_schedule`, `weekly_schedule_day` e `weekly_schedule_lesson`.
- As contagens de `tenant`, `user`, `school`, `academic_calendar` e `academic_calendar_day` antes e depois da migration são idênticas.

**Validação**
- `mysql -h 127.0.0.1 -P 3307 -u rag -prag geduc_rag -e "SELECT (SELECT COUNT(*) FROM tenant) t, (SELECT COUNT(*) FROM user) u, (SELECT COUNT(*) FROM school) s, (SELECT COUNT(*) FROM academic_calendar) c, (SELECT COUNT(*) FROM academic_calendar_day) d"` antes da migration (evidência: os cinco números, anotados no relatório)
- `cd backend && npm run db:migrate` (evidência: linhas `db:migrate em localhost` e `applied: 0005_weekly_schedule`); repetir (evidência: `applied: (nenhuma)`)
- `mysql -h 127.0.0.1 -P 3307 -u rag -prag geduc_rag -e "SHOW TABLES LIKE 'subject'; SHOW TABLES LIKE 'school_class'; SHOW TABLES LIKE 'weekly_schedule%'; SHOW CREATE TABLE weekly_schedule_lesson\G"` (evidência: as 5 tabelas e as linhas `start_time time NOT NULL` e `content_recorded tinyint(1) NOT NULL DEFAULT '0'`)
- `mysql -h 127.0.0.1 -P 3307 -u rag -prag geduc_rag -e "SHOW CREATE TABLE weekly_schedule_day\G"` (evidência: `calendar_id varchar(191) ... DEFAULT NULL` e `day_type enum(...) ... DEFAULT NULL`)
- A mesma consulta de contagem depois da migration (evidência: `t`, `u`, `s`, `c`, `d` iguais aos de antes)

### T-02 — Códigos de erro novos + regras puras do horário

**Camada:** backend
**Dependências:** nenhuma
**Paralelizável:** sim
**Complexidade:** alta
**Agente:** Arquimedes

**Arquivos prováveis**
- `backend/src/common/errors/error-codes.ts`
- `backend/src/modules/weekly-schedules/weekly-schedule.rules.ts`
- `backend/src/modules/weekly-schedules/__tests__/weekly-schedule.rules.spec.ts`

**Interface**
- Produz (em `ERROR_CODES`, seções novas "Disciplinas", "Turmas" e "Horário semanal" depois de "Calendário acadêmico", com comentário de status como as demais; valor de cada chave = o próprio nome): `SUBJECT_NOT_FOUND` (404), `SUBJECT_NAME_TAKEN` (409), `SCHOOL_CLASS_NOT_FOUND` (404), `SCHOOL_CLASS_NAME_TAKEN` (409), `SCHOOL_CLASS_SCHOOL_INVALID` (400), `SCHEDULE_NOT_FOUND` (404), `SCHEDULE_LESSON_NOT_FOUND` (404), `SCHEDULE_INVALID_PERIOD` (400), `SCHEDULE_WEEK_TAKEN` (409), `SCHEDULE_CALENDAR_NOT_FOUND` (400), `SCHEDULE_LESSON_INVALID_TIME` (400), `SCHEDULE_LESSON_OVERLAP` (400), `SCHEDULE_LESSON_ON_NON_SCHOOL_DAY` (400), `SCHEDULE_SATURDAY_WITHOUT_LESSONS` (400), `SCHEDULE_SUBJECTS_INVALID` (400), `SCHEDULE_HAS_RECORDS` (409)
- Produz (em `weekly-schedule.rules.ts`, importando `DayType`, `DatePeriod` e `weekdayOf` de `../academic-calendar/academic-calendar.rules`): `export const SCHEDULE_STATUSES = ['UP_TO_DATE', 'OUTDATED'] as const`, `export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number]`, `export const DISCARD_REASONS = ['NON_SCHOOL_DAY', 'RECORDED_CONFLICT'] as const`, `export type DiscardReason = (typeof DISCARD_REASONS)[number]`
- Produz: `export interface LessonSlot { subjectId: string; startTime: string; endTime: string }` (horas `HH:mm`), `export interface RecordFlags { contentRecorded: boolean; attendanceRecorded: boolean }`, `export type FlaggedLesson = LessonSlot & RecordFlags`, `export type DatedLesson = FlaggedLesson & { date: string }`, `export interface PlannedDay { date: string; lessons: LessonSlot[] }`, `export interface FlaggedDay { date: string; lessons: FlaggedLesson[] }`, `export type DiscardedLesson = LessonSlot & { date: string; reason: DiscardReason }`, `export interface CalendarDayCandidate { date: string; calendarId: string; type: DayType; specific: boolean }`, `export interface ResolvedCalendarDay { date: string; calendarId: string | null; type: DayType | null }` — toda data é texto `YYYY-MM-DD`; `null` = data fora de qualquer calendário
- Produz: `export function addDays(date: string, days: number): string` (aritmética em UTC), `export function listPeriodDates(startDate: string, endDate: string): string[]` (inclusivo nas duas pontas, ordem crescente) e `export function weekPeriod(startDate: string): DatePeriod` (`endDate = addDays(startDate, 6)`)
- Produz: `export function assertScheduleWeek(period: DatePeriod, schoolYear: number): void` — lança `BadRequestException({ code: ERROR_CODES.SCHEDULE_INVALID_PERIOD, message })` se `weekdayOf(startDate) !== 1` (não é segunda), se `endDate !== addDays(startDate, 6)` ou se nem `startDate` nem `endDate` começa com `schoolYear`
- Produz: `export function assertLessonsValid(lessons: readonly LessonSlot[]): void` — `startTime >= endTime` → `BadRequestException` `SCHEDULE_LESSON_INVALID_TIME`; duas aulas que se cruzam (`a.startTime < b.endTime && b.startTime < a.endTime`) → `BadRequestException` `SCHEDULE_LESSON_OVERLAP`
- Produz: `export function normalizePlannedDays(period: DatePeriod, days: readonly PlannedDay[]): PlannedDay[]` — um item por data de `listPeriodDates(period.startDate, period.endDate)`, na ordem; data ausente → `lessons: []`; aulas ordenadas por `startTime`; data fora do período ou repetida → `BadRequestException` `SCHEDULE_INVALID_PERIOD`; aplica `assertLessonsValid` a cada dia
- Produz: `export function resolveCalendarDays(dates: readonly string[], candidates: readonly CalendarDayCandidate[]): ResolvedCalendarDay[]` — um item por data, na ordem de `dates`; entre os candidatos da data, `specific: true` prevalece sobre `false`; empate → menor `calendarId`; data sem candidato → `{ date, calendarId: null, type: null }`; nenhuma data com candidato → `BadRequestException` `SCHEDULE_CALENDAR_NOT_FOUND`
- Produz: `export function assertSaturdayLessons(days: readonly PlannedDay[], calendar: readonly ResolvedCalendarDay[]): void` — sábado (`weekdayOf(date) === 6`) com `type === 'SCHOOL_DAY'` e `lessons.length === 0` → `BadRequestException` `SCHEDULE_SATURDAY_WITHOUT_LESSONS` com a data na `message` (aceita `FlaggedDay[]`, compatível por estrutura)
- Produz: `export function assertDaysMatchCalendar(days: readonly PlannedDay[], calendar: readonly ResolvedCalendarDay[]): void` — dia com aula cujo `type !== 'SCHOOL_DAY'` (inclusive `null`) → `BadRequestException` `SCHEDULE_LESSON_ON_NON_SCHOOL_DAY` com a data na `message`; depois aplica `assertSaturdayLessons`
- Produz: `export function replicateDays(source: readonly PlannedDay[], targetDates: readonly string[], calendar: readonly ResolvedCalendarDay[]): { days: PlannedDay[]; discarded: DiscardedLesson[] }` — para cada data alvo, as aulas do dia de origem com o mesmo `weekdayOf`; quando o `type` da data alvo não é `SCHOOL_DAY`, o dia fica `lessons: []` e essas aulas vão para `discarded` com `reason: 'NON_SCHOOL_DAY'`
- Produz: `export function mergeWithRecorded(replicated: readonly PlannedDay[], existing: readonly DatedLesson[]): { days: FlaggedDay[]; preserved: DatedLesson[]; discarded: DiscardedLesson[] }` — `preserved` = aulas de `existing` com `contentRecorded` ou `attendanceRecorded` `true`, que ficam no dia com as flags; aulas de `existing` sem registro saem; aula replicada idêntica a uma preservada (mesma `subjectId`, `startTime`, `endTime`) é absorvida; aula replicada que se cruza com uma preservada do mesmo dia vai para `discarded` com `reason: 'RECORDED_CONFLICT'`; as demais entram com flags `false`; aulas de cada dia ordenadas por `startTime`
- Produz: `export function carryLessonRecords(existing: readonly DatedLesson[], planned: readonly PlannedDay[]): FlaggedDay[]` — os dias de `planned` com flags; aula idêntica por `(date, startTime, endTime, subjectId)` herda as flags da existente, as demais nascem `false`; aula existente com `contentRecorded` ou `attendanceRecorded` `true` sem par idêntico em `planned` → `ConflictException({ code: ERROR_CODES.SCHEDULE_HAS_RECORDS, message })`
- Consome: nada

**Teste RED**
- `backend/src/modules/weekly-schedules/__tests__/weekly-schedule.rules.spec.ts` — falha antes de existir `weekly-schedule.rules.ts`: `weekPeriod('2026-10-12')` = `{ startDate: '2026-10-12', endDate: '2026-10-18' }`; `assertScheduleWeek({ startDate: '2026-09-28', endDate: '2026-10-04' }, 2026)` não lança, e lançam `code: 'SCHEDULE_INVALID_PERIOD'` `{ startDate: '2026-09-27', endDate: '2026-10-03' }` (domingo) e `{ startDate: '2026-09-28', endDate: '2026-10-05' }` (8 dias); `assertScheduleWeek({ startDate: '2026-12-28', endDate: '2027-01-03' }, 2026)` não lança; `assertLessonsValid` com `07:30–08:20` e `08:10–09:00` lança `SCHEDULE_LESSON_OVERLAP`, com `07:30–08:20` e `08:20–09:10` não lança, com `09:00–09:00` lança `SCHEDULE_LESSON_INVALID_TIME`; `resolveCalendarDays(['2026-10-03'], [{ date: '2026-10-03', calendarId: 'geral', type: 'NON_SCHOOL_DAY', specific: false }, { date: '2026-10-03', calendarId: 'escola', type: 'SCHOOL_DAY', specific: true }])` devolve `[{ date: '2026-10-03', calendarId: 'escola', type: 'SCHOOL_DAY' }]`; `resolveCalendarDays(['2026-12-18', '2026-12-19'], [{ date: '2026-12-18', calendarId: 'escola', type: 'SCHOOL_DAY', specific: true }])` devolve o segundo item `{ date: '2026-12-19', calendarId: null, type: null }` e `resolveCalendarDays(['2026-10-04'], [])` lança `SCHEDULE_CALENDAR_NOT_FOUND`; `assertDaysMatchCalendar` com `2026-10-03` (sábado) `SCHOOL_DAY` sem aulas lança `SCHEDULE_SATURDAY_WITHOUT_LESSONS`, com aula em `2026-10-12` `NON_SCHOOL_DAY` lança `SCHEDULE_LESSON_ON_NON_SCHOOL_DAY` e com aula em `2026-12-19` de `type: null` também; `replicateDays` de origem com aula na segunda `2026-09-28` para `listPeriodDates('2026-10-12', '2026-10-18')` com `2026-10-12` `NON_SCHOOL_DAY` devolve `2026-10-12` com `lessons: []` e a aula em `discarded` com `reason: 'NON_SCHOOL_DAY'`; `mergeWithRecorded` com existente `2026-10-19` `08:20–09:10` `attendanceRecorded: true` e `10:00–10:50` sem registro, e replicadas `08:00–08:50` e `09:10–10:00` no mesmo dia, devolve o dia com `08:20–09:10` (flags mantidas) e `09:10–10:00` (flags `false`), `preserved` com a `08:20` e `discarded` com a `08:00` e `reason: 'RECORDED_CONFLICT'`; `carryLessonRecords` que remove aula existente com `attendanceRecorded: true` lança `code: 'SCHEDULE_HAS_RECORDS'` (fonte das datas: calendário civil — `2026-09-27` e `2026-10-04` são domingos, `2026-10-03` e `2026-12-19` são sábados, `2026-09-28`, `2026-10-12`, `2026-10-19` e `2026-12-28` são segundas) (comando: `cd backend && npx jest src/modules/weekly-schedules/__tests__/weekly-schedule.rules.spec.ts`)

**Critério de aceite**
- O spec de regras passa com todos os casos do Teste RED e o do Review Focus de T-02 (semana com fim do calendário no meio), e as 16 chaves novas existem em `ERROR_CODES`.
- `npx tsc --noEmit` e `npx eslint "{src,test}/**/*.ts"` em `backend/` terminam com exit 0 e saída vazia.

**Validação**
- `cd backend && npx jest src/modules/weekly-schedules/__tests__/weekly-schedule.rules.spec.ts` (evidência: `PASS` e `Tests:` sem `failed`)
- `cd backend && npx jest src/modules/weekly-schedules/__tests__/weekly-schedule.rules.spec.ts -t "2026-12-19"` — Review Focus: dias sem calendário viram `calendarId: null`/`type: null` sem erro e recusam aula (evidência: os casos listados como `✓`)
- `cd backend && npx tsc --noEmit && npx eslint "{src,test}/**/*.ts"` (evidência: exit 0, nenhuma linha de saída)
- `grep -cE "^  (SUBJECT|SCHOOL_CLASS|SCHEDULE)_" backend/src/common/errors/error-codes.ts` (evidência: `16`)

### T-03 — Módulo de disciplinas (`/subjects`)

**Camada:** backend
**Dependências:** T-01, T-02
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Levi

**Arquivos prováveis**
- `backend/src/modules/subjects/application/interface/repository/subject.repository.interface.ts`
- `backend/src/modules/subjects/infra/database/repositories/subject.repository.ts`
- `backend/src/modules/subjects/infra/database/queries/subject-list.query.ts`
- `backend/src/modules/subjects/dto/subject.dto.ts`
- `backend/src/modules/subjects/subjects.service.ts`
- `backend/src/modules/subjects/subjects.controller.ts`
- `backend/src/modules/subjects/subjects.module.ts`
- `backend/src/modules/subjects/__tests__/subject.repository.spec.ts`
- `backend/src/modules/subjects/__tests__/subjects.service.spec.ts`

**Interface**
- Produz: `export const SUBJECT_REPOSITORY = 'ISubjectRepository'`
- Produz: `export interface SubjectRecord { id: string; tenantId: string; name: string; active: boolean; createdAt: Date; updatedAt: Date }`, `export interface SubjectListFilter { tenantId: string; active?: boolean; search?: string; page: number; limit: number }`, `export interface CreateSubjectInput { tenantId: string; name: string; active: boolean; createdById: string }`, `export interface UpdateSubjectInput { name?: string; active?: boolean; updatedById: string }`
- Produz: `export interface ISubjectRepository` com `list(filter: SubjectListFilter): Promise<{ data: SubjectRecord[]; total: number }>` (não excluídas, ordem `sub.name ASC, sub.id ASC`, busca parcial em `sub.name`), `findById(tenantId: string, id: string): Promise<SubjectRecord | null>`, `findIdByName(tenantId: string, name: string): Promise<string | null>` (não filtra exclusão), `create(input: CreateSubjectInput): Promise<SubjectRecord>`, `update(tenantId: string, id: string, input: UpdateSubjectInput): Promise<SubjectRecord>`, `softDelete(tenantId: string, id: string, deletedById: string): Promise<void>` (`active = 0`, `deleted_at = NOW(3)`); `export class SubjectRepository implements ISubjectRepository` com `constructor(private readonly db: IDatabaseConnection)`, alias `sub`
- Produz: `export class SubjectsModule` e as rotas (todas `@TenantScoped()` + `@RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)`): `GET /subjects` (`search`, `active`, `page`, `limit`) → 200 `{ data: SubjectResponseDto[]; total: number }`; `GET /subjects/:id` → 200 ou 404 `SUBJECT_NOT_FOUND`; `POST /subjects` `{ name: string; active?: boolean }` → 201 ou 409 `SUBJECT_NAME_TAKEN`; `PATCH /subjects/:id` → 200, 404 ou 409; `DELETE /subjects/:id` → 204 ou 404. `SubjectResponseDto = { id, tenantId, name, active, createdAt, updatedAt }`
- Consome: T-01 `subject(id, tenant_id, name, active, created_at, updated_at, deleted_at, created_by_id, updated_by_id, deleted_by_id)`; T-02 `SUBJECT_NOT_FOUND`, `SUBJECT_NAME_TAKEN`

**Teste RED**
- `backend/src/modules/subjects/__tests__/subject.repository.spec.ts`, `backend/src/modules/subjects/__tests__/subjects.service.spec.ts` — falham antes de existirem `SubjectRepository` e `SubjectsService`: com a conexão falsa copiada de `backend/src/modules/schools/__tests__/school.repository.spec.ts` (`makeConnection`), `list` emite SQL com `sub.tenant_id = ?`, `sub.deleted_at IS NULL` e `ORDER BY sub.name ASC, sub.id ASC`; `findIdByName('t1', 'Matemática')` emite `SELECT id FROM subject WHERE tenant_id = ? AND name = ?` com params `['t1', 'Matemática']`; `softDelete` emite `UPDATE subject` com `deleted_at = NOW(3)`; no service com repositório `jest.Mocked`, `create` com `findIdByName` devolvendo um id → rejeita com `code: 'SUBJECT_NAME_TAKEN'` e `findOne` com `findById` `null` → `code: 'SUBJECT_NOT_FOUND'` (comando: `cd backend && npx jest src/modules/subjects`)

**Critério de aceite**
- Os dois specs de `src/modules/subjects` passam; nenhuma query usa `SELECT *` nem interpola valor.
- `npx tsc --noEmit` e `npx eslint "{src,test}/**/*.ts"` em `backend/` com exit 0 e saída vazia.

**Validação**
- `cd backend && npx jest src/modules/subjects` (evidência: 2 suítes `PASS`, `Tests:` sem `failed`)
- `cd backend && npx tsc --noEmit && npx eslint "{src,test}/**/*.ts"` (evidência: exit 0, nenhuma linha de saída)
- `grep -rn "SELECT \*" backend/src/modules/subjects` (evidência: nenhuma linha)

### T-04 — Módulo de turmas (`/school-classes`)

**Camada:** backend
**Dependências:** T-01, T-02
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Platão

**Arquivos prováveis**
- `backend/src/modules/school-classes/application/interface/repository/school-class.repository.interface.ts`
- `backend/src/modules/school-classes/infra/database/repositories/school-class.repository.ts`
- `backend/src/modules/school-classes/infra/database/queries/school-class-list.query.ts`
- `backend/src/modules/school-classes/dto/school-class.dto.ts`
- `backend/src/modules/school-classes/school-classes.service.ts`
- `backend/src/modules/school-classes/school-classes.controller.ts`
- `backend/src/modules/school-classes/school-classes.module.ts`
- `backend/src/modules/school-classes/__tests__/school-class.repository.spec.ts`
- `backend/src/modules/school-classes/__tests__/school-classes.service.spec.ts`

**Interface**
- Produz: `export const SCHOOL_CLASS_REPOSITORY = 'ISchoolClassRepository'`
- Produz: `export interface SchoolClassRecord { id: string; tenantId: string; schoolId: string; schoolName: string; schoolYear: number; name: string; active: boolean; createdAt: Date; updatedAt: Date }`, `export interface SchoolClassListFilter { tenantId: string; schoolId?: string; schoolYear?: number; active?: boolean; search?: string; page: number; limit: number }`, `export interface CreateSchoolClassInput { tenantId: string; schoolId: string; schoolYear: number; name: string; active: boolean; createdById: string }`, `export interface UpdateSchoolClassInput { name?: string; active?: boolean; updatedById: string }`
- Produz: `export interface ISchoolClassRepository` com `list(filter: SchoolClassListFilter): Promise<{ data: SchoolClassRecord[]; total: number }>` (não excluídas, join com `school sch` para `schoolName`, ordem `sc.school_year DESC, sc.name ASC, sc.id ASC`), `findById(tenantId: string, id: string): Promise<SchoolClassRecord | null>`, `findIdByName(tenantId: string, schoolId: string, schoolYear: number, name: string): Promise<string | null>` (não filtra exclusão), `schoolExists(tenantId: string, schoolId: string): Promise<boolean>` (escola não excluída do tenant), `create(input: CreateSchoolClassInput): Promise<SchoolClassRecord>`, `update(tenantId: string, id: string, input: UpdateSchoolClassInput): Promise<SchoolClassRecord>`, `softDelete(tenantId: string, id: string, deletedById: string): Promise<void>`; `export class SchoolClassRepository implements ISchoolClassRepository` com `constructor(private readonly db: IDatabaseConnection)`, alias `sc`
- Produz: `export class SchoolClassesModule` e as rotas (todas `@TenantScoped()` + `@RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)`): `GET /school-classes` (`schoolId`, `schoolYear`, `search`, `active`, `page`, `limit`) → 200 `{ data: SchoolClassResponseDto[]; total: number }`; `GET /school-classes/:id` → 200 ou 404 `SCHOOL_CLASS_NOT_FOUND`; `POST /school-classes` `{ schoolId: string; schoolYear: number; name: string; active?: boolean }` → 201, 400 `SCHOOL_CLASS_SCHOOL_INVALID` (escola inexistente, excluída ou de outro tenant) ou 409 `SCHOOL_CLASS_NAME_TAKEN`; `PATCH /school-classes/:id` `{ name?: string; active?: boolean }` (escola e ano imutáveis) → 200, 404 ou 409; `DELETE /school-classes/:id` → 204 ou 404. `SchoolClassResponseDto = { id, tenantId, schoolId, schoolName, schoolYear, name, active, createdAt, updatedAt }`; `schoolYear` inteiro de 2000 a 2100
- Consome: T-01 `school_class(id, tenant_id, school_id, school_year, name, active, created_at, updated_at, deleted_at, created_by_id, updated_by_id, deleted_by_id)`; T-02 `SCHOOL_CLASS_NOT_FOUND`, `SCHOOL_CLASS_NAME_TAKEN`, `SCHOOL_CLASS_SCHOOL_INVALID`

**Teste RED**
- `backend/src/modules/school-classes/__tests__/school-class.repository.spec.ts`, `backend/src/modules/school-classes/__tests__/school-classes.service.spec.ts` — falham antes de existirem `SchoolClassRepository` e `SchoolClassesService`: com a conexão falsa copiada de `backend/src/modules/schools/__tests__/school.repository.spec.ts` (`makeConnection`), `list` emite SQL com `sc.tenant_id = ?`, `sc.deleted_at IS NULL`, `JOIN school sch` e `ORDER BY sc.school_year DESC, sc.name ASC, sc.id ASC`; `schoolExists('t1', 's1')` emite SQL em `school` com `tenant_id = ?`, `id = ?` e `deleted_at IS NULL`; `findIdByName('t1', 's1', 2026, '8º A')` passa params `['t1', 's1', 2026, '8º A']`; no service com repositório `jest.Mocked`, `create` com `schoolExists` `false` → rejeita com `code: 'SCHOOL_CLASS_SCHOOL_INVALID'` e `create` não é chamado, e com `findIdByName` devolvendo id → `code: 'SCHOOL_CLASS_NAME_TAKEN'` (comando: `cd backend && npx jest src/modules/school-classes`)

**Critério de aceite**
- Os dois specs de `src/modules/school-classes` passam; nenhuma query usa `SELECT *` nem interpola valor.
- `npx tsc --noEmit` e `npx eslint "{src,test}/**/*.ts"` em `backend/` com exit 0 e saída vazia.

**Validação**
- `cd backend && npx jest src/modules/school-classes` (evidência: 2 suítes `PASS`, `Tests:` sem `failed`)
- `cd backend && npx tsc --noEmit && npx eslint "{src,test}/**/*.ts"` (evidência: exit 0, nenhuma linha de saída)
- `grep -rn "SELECT \*" backend/src/modules/school-classes` (evidência: nenhuma linha)

### T-05 — Repositório SQL do horário semanal

**Camada:** backend
**Dependências:** T-01, T-02
**Paralelizável:** sim
**Complexidade:** alta
**Agente:** Saitama

**Arquivos prováveis**
- `backend/src/modules/weekly-schedules/application/interface/repository/weekly-schedule.repository.interface.ts`
- `backend/src/modules/weekly-schedules/infra/database/repositories/weekly-schedule.repository.ts`
- `backend/src/modules/weekly-schedules/infra/database/queries/weekly-schedule-list.query.ts`
- `backend/src/modules/weekly-schedules/__tests__/weekly-schedule.repository.spec.ts`

**Interface**
- Produz: `export const WEEKLY_SCHEDULE_REPOSITORY = 'IWeeklyScheduleRepository'`
- Produz: `export interface ScheduleClassRecord { id: string; schoolId: string; schoolYear: number }`
- Produz: `export interface WeeklyScheduleLessonRecord { id: string; subjectId: string; subjectName: string; startTime: string; endTime: string; contentRecorded: boolean; attendanceRecorded: boolean; updatedAt: Date }` (horas `HH:mm` lidas com `TIME_FORMAT(<coluna>, '%H:%i')`)
- Produz: `export interface WeeklyScheduleDayRecord { date: string; calendarId: string | null; dayType: DayType | null; lessons: WeeklyScheduleLessonRecord[] }` (aulas por `startTime` crescente)
- Produz: `export interface WeeklyScheduleSummaryRecord { id: string; tenantId: string; schoolClassId: string; startDate: string; endDate: string; status: ScheduleStatus; lessonCount: number; contentRecordedCount: number; attendanceRecordedCount: number; createdAt: Date; updatedAt: Date }` e `export interface WeeklyScheduleRecord extends WeeklyScheduleSummaryRecord { days: WeeklyScheduleDayRecord[] }` (dias por data crescente)
- Produz: `export interface WeeklyScheduleListFilter { tenantId: string; schoolClassId?: string; from?: string; to?: string; page: number; limit: number }` (`from`/`to`: semana do horário cruza o intervalo informado)
- Produz: `export interface ScheduleDayInput { date: string; calendarId: string | null; dayType: DayType | null; lessons: FlaggedLesson[] }`, `export interface NewWeekInput { schoolClassId: string; startDate: string; endDate: string; days: ScheduleDayInput[] }`, `export interface ReplaceWeekInput { id: string; days: ScheduleDayInput[] }`, `export interface SaveWeeksInput { tenantId: string; actorId: string; creates: readonly NewWeekInput[]; replaces: readonly ReplaceWeekInput[] }`, `export interface SaveWeeksResult { created: WeeklyScheduleRecord[]; replaced: WeeklyScheduleRecord[] }`, `export interface UpdateLessonRecordInput { contentRecorded?: boolean; attendanceRecorded?: boolean; updatedById: string }`
- Produz: `export interface IWeeklyScheduleRepository` com os métodos abaixo (cada item é um método da interface)
- Produz: `findClass(tenantId: string, schoolClassId: string): Promise<ScheduleClassRecord | null>` (turma não excluída)
- Produz: `findExistingSubjectIds(tenantId: string, subjectIds: readonly string[]): Promise<string[]>` (disciplinas não excluídas; lista vazia → `[]` sem SQL)
- Produz: `findCalendarCandidates(tenantId: string, schoolId: string, dates: readonly string[]): Promise<CalendarDayCandidate[]>` (uma query: `academic_calendar_day d` + `academic_calendar c` não excluído + `LEFT JOIN academic_calendar_school acs` na escola, filtro `c.all_schools = 1 OR acs.school_id IS NOT NULL`, `d.day_date IN (?)`; `specific` = vínculo com a escola, coluna `is_specific`; lista vazia → `[]` sem SQL)
- Produz: `findByWeeks(tenantId: string, schoolClassId: string, startDates: readonly string[]): Promise<WeeklyScheduleRecord[]>` (horários não excluídos da turma com `ws.start_date IN (?)`, com dias e aulas — três queries no total; lista vazia → `[]` sem SQL)
- Produz: `list(filter: WeeklyScheduleListFilter): Promise<{ data: WeeklyScheduleSummaryRecord[]; total: number }>` (ordem `ws.start_date DESC, ws.id ASC`)
- Produz: `findById(tenantId: string, id: string): Promise<WeeklyScheduleRecord | null>` (horário não excluído; três queries: horário, dias, aulas com `subject` — sem N+1)
- Produz: `saveWeeks(input: SaveWeeksInput): Promise<SaveWeeksResult>` (uma transação, número fixo de comandos independente do número de semanas: `INSERT INTO weekly_schedule ... VALUES ?` dos `creates` (se houver); `UPDATE weekly_schedule SET updated_at = NOW(3), updated_by_id = ? WHERE tenant_id = ? AND id IN (?)` e `DELETE FROM weekly_schedule_day WHERE tenant_id = ? AND schedule_id IN (?)` dos `replaces` (se houver; aulas caem por CASCADE); `INSERT INTO weekly_schedule_day ... VALUES ?` e `INSERT INTO weekly_schedule_lesson ... VALUES ?` de todos; devolve `created`/`replaced` na ordem dos inputs)
- Produz: `softDelete(tenantId: string, id: string, deletedById: string): Promise<void>`
- Produz: `updateLessonRecord(tenantId: string, scheduleId: string, lessonId: string, input: UpdateLessonRecordInput): Promise<WeeklyScheduleLessonRecord | null>` (`null` quando a aula não pertence a horário não excluído do tenant)
- Produz: `export class WeeklyScheduleRepository implements IWeeklyScheduleRepository` com `constructor(private readonly db: IDatabaseConnection)`; aliases `ws` (horário), `wd` (dia), `l` (aula), `sub` (disciplina), `c`/`cd`/`acs` (calendário); datas com `DATE_FORMAT(<coluna>, '%Y-%m-%d')`; `status` em SQL: `CASE WHEN EXISTS (SELECT 1 FROM weekly_schedule_day wd LEFT JOIN academic_calendar c ON c.id = wd.calendar_id AND c.deleted_at IS NULL LEFT JOIN academic_calendar_day cd ON cd.calendar_id = c.id AND cd.day_date = wd.day_date WHERE wd.schedule_id = ws.id AND wd.calendar_id IS NOT NULL AND (cd.day_type IS NULL OR cd.day_type <> wd.day_type)) THEN 'OUTDATED' ELSE 'UP_TO_DATE' END`, o mesmo na listagem e no detalhe; contagens `lessonCount`/`contentRecordedCount`/`attendanceRecordedCount` por subquery agregada (sem N+1)
- Consome: T-01 `weekly_schedule(id, tenant_id, school_class_id, start_date, end_date, created_at, updated_at, deleted_at, created_by_id, updated_by_id, deleted_by_id)`, `weekly_schedule_day(id, tenant_id, schedule_id, day_date, calendar_id, day_type, created_at, updated_at)`, `weekly_schedule_lesson(id, tenant_id, schedule_day_id, subject_id, start_time, end_time, content_recorded, attendance_recorded, created_at, updated_at, updated_by_id)`; T-02 `export type FlaggedLesson = LessonSlot & RecordFlags`, `export interface CalendarDayCandidate { date: string; calendarId: string; type: DayType; specific: boolean }`, `export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number]`

**Teste RED**
- `backend/src/modules/weekly-schedules/__tests__/weekly-schedule.repository.spec.ts` — falha antes de existir `WeeklyScheduleRepository`: com a conexão falsa copiada de `backend/src/modules/schools/__tests__/school.repository.spec.ts` (`makeConnection`), `findCalendarCandidates('t1', 's1', [])` e `findByWeeks('t1', 'sc1', [])` devolvem `[]` sem nenhuma chamada SQL; `findCalendarCandidates('t1', 's1', ['2026-10-03'])` emite SQL com `c.all_schools = 1`, `academic_calendar_school`, `d.day_date IN (?)` e `c.deleted_at IS NULL` e mapeia linha `{ is_specific: 1 }` para `specific: true`; `findByWeeks('t1', 'sc1', ['2026-10-19'])` emite `ws.start_date IN (?)` e `ws.deleted_at IS NULL`; `findById` emite SQL com `DATE_FORMAT(ws.start_date, '%Y-%m-%d')`, `TIME_FORMAT(l.start_time, '%H:%i')`, `wd.calendar_id IS NOT NULL` e `cd.day_type <> wd.day_type` … `'OUTDATED'`, a linha `{ status: 'OUTDATED' }` chega como `status: 'OUTDATED'` e a linha de dia `{ calendar_id: null, day_type: null }` chega como `calendarId: null, dayType: null`; `saveWeeks` com 1 `create` e 1 `replace` roda num único `runInTransaction` e emite exatamente um `INSERT INTO weekly_schedule ` com `VALUES ?`, um `UPDATE weekly_schedule` com `id IN (?)`, um `DELETE FROM weekly_schedule_day` com `schedule_id IN (?)`, um `INSERT INTO weekly_schedule_day` e um `INSERT INTO weekly_schedule_lesson`, ambos com `VALUES ?` (comando: `cd backend && npx jest src/modules/weekly-schedules/__tests__/weekly-schedule.repository.spec.ts`)

**Critério de aceite**
- O spec do repositório passa com os casos do Teste RED e o do Review Focus de T-05 (situação `OUTDATED`), além de `startTime: '07:30'` para a linha `{ start_time: '07:30' }`.
- Nenhuma query usa `SELECT *`, interpola valor ou roda `query()` dentro de `for`/`map`.
- `npx tsc --noEmit` e `npx eslint "{src,test}/**/*.ts"` em `backend/` com exit 0 e saída vazia.

**Validação**
- `cd backend && npx jest src/modules/weekly-schedules/__tests__/weekly-schedule.repository.spec.ts` (evidência: `PASS`, `Tests:` sem `failed`)
- `cd backend && npx jest src/modules/weekly-schedules/__tests__/weekly-schedule.repository.spec.ts -t "OUTDATED|TIME_FORMAT"` — Review Focus: o SQL de situação compara `wd.day_type` com `cd.day_type` só em dia com calendário, e `{ start_time: '07:30' }` vira `startTime: '07:30'` (evidência: os casos listados como `✓`)
- `cd backend && npx tsc --noEmit && npx eslint "{src,test}/**/*.ts"` (evidência: exit 0, nenhuma linha de saída)
- `grep -rn "SELECT \*" backend/src/modules/weekly-schedules` (evidência: nenhuma linha)

### T-06 — Service, DTOs, controller e module do horário semanal

**Camada:** backend
**Dependências:** T-02, T-05
**Paralelizável:** não
**Complexidade:** alta
**Agente:** Jaspion

**Arquivos prováveis**
- `backend/src/modules/weekly-schedules/dto/weekly-schedule.dto.ts`
- `backend/src/modules/weekly-schedules/weekly-schedules.service.ts`
- `backend/src/modules/weekly-schedules/weekly-schedules.controller.ts`
- `backend/src/modules/weekly-schedules/weekly-schedules.module.ts`
- `backend/src/modules/weekly-schedules/__tests__/weekly-schedules.service.spec.ts`

**Interface**
- Produz: `export class WeeklySchedulesModule` (provider `WEEKLY_SCHEDULE_REPOSITORY` por `useFactory` + `inject: [DATABASE_CONNECTION]`, sem `exports`) e `export class WeeklySchedulesController` com `@TenantScoped()` e `@RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)` em todas as rotas
- Produz (rotas): `GET /weekly-schedules` (`schoolClassId`, `from`, `to`, `page`, `limit`) → 200 `{ data: WeeklyScheduleSummaryResponseDto[]; total: number }`; `GET /weekly-schedules/:id` → 200 `WeeklyScheduleResponseDto` ou 404 `SCHEDULE_NOT_FOUND`; `POST /weekly-schedules` → 201 `WeeklyScheduleResponseDto` ou 409 `SCHEDULE_WEEK_TAKEN`; `PUT /weekly-schedules/:id` → 200 `WeeklyScheduleResponseDto`; `DELETE /weekly-schedules/:id` → 204 ou 409 `SCHEDULE_HAS_RECORDS`; `POST /weekly-schedules/:id/replicate` → 201 `{ data: ReplicationResultDto[] }`; `PATCH /weekly-schedules/:id/lessons/:lessonId/record` → 200 `ScheduleLessonResponseDto` ou 404 `SCHEDULE_LESSON_NOT_FOUND`
- Produz (payloads): `CreateWeeklyScheduleDto = { schoolClassId: string (UUID); startDate: string; endDate: string; days: { date: string; lessons: { subjectId: string (UUID); startTime: string; endTime: string }[] }[] }` (datas `YYYY-MM-DD` com cópia local do validador `IsCalendarDate` de `academic-calendar.dto.ts` — `Matches(/^\d{4}-\d{2}-\d{2}$/)` + `IsDateString({ strict: true })`, recusa `2026-02-30`; ele não é exportado e aquele arquivo não é desta task; segunda e `endDate = startDate + 6` conferidos por `assertScheduleWeek` no service; horas `HH:mm` por `@Matches(/^([01]\d|2[0-3]):[0-5]\d$/)`; `days` até 7 itens, `lessons` até 20 por dia); `UpdateWeeklyScheduleDto = { days: ScheduleDayDto[] }` (PUT: substitui os dias; turma e semana imutáveis); `ReplicateWeeklyScheduleDto = { targetStartDates: string[] }` (1 a 20, `@ArrayUnique`, os mesmos validadores de data com `{ each: true }`); `UpdateLessonRecordDto = { contentRecorded?: boolean; attendanceRecorded?: boolean }` (`@IsOptionalNotNull()`); `ListWeeklySchedulesDto extends PaginationQueryDto`
- Produz (respostas): `WeeklyScheduleSummaryResponseDto = { id, schoolClassId, startDate, endDate, status: 'UP_TO_DATE' | 'OUTDATED', record: { lessons: number; contentRecorded: number; attendanceRecorded: number }, createdAt, updatedAt }`; `WeeklyScheduleResponseDto = WeeklyScheduleSummaryResponseDto & { days: ScheduleDayResponseDto[] }`; `ScheduleDayResponseDto = { date, weekday: number (0 = domingo … 6 = sábado), dayType: DayType | null (null = fora do calendário), hasClass: boolean (dayType === 'SCHOOL_DAY'), lessons: ScheduleLessonResponseDto[] }`; `ScheduleLessonResponseDto = { id, subjectId, subjectName, startTime, endTime, contentRecorded, attendanceRecorded }`; `ReplicationResultDto = { action: 'CREATED' | 'OVERWRITTEN'; schedule: WeeklyScheduleResponseDto; preserved: { date, subjectId, startTime, endTime, contentRecorded, attendanceRecorded }[]; discarded: { date, subjectId, startTime, endTime, reason: 'NON_SCHOOL_DAY' | 'RECORDED_CONFLICT' }[] }`, na ordem de `targetStartDates`
- Produz (fluxo de `create`): turma por `findClass` (null → 404 `SCHOOL_CLASS_NOT_FOUND`) → `assertScheduleWeek` com `schoolYear` da turma → `normalizePlannedDays` → `findExistingSubjectIds` (faltou id → 400 `SCHEDULE_SUBJECTS_INVALID`) → `findCalendarCandidates` + `resolveCalendarDays` → `assertDaysMatchCalendar` → `findByWeeks` com a `startDate` (não vazio → 409 `SCHEDULE_WEEK_TAKEN`) → `saveWeeks({ creates: [..], replaces: [] })`
- Produz (fluxo de `update`): horário por `findById` (404 `SCHEDULE_NOT_FOUND`) → turma → `normalizePlannedDays` com a semana atual → disciplinas → calendário → `assertDaysMatchCalendar` → `carryLessonRecords` com as aulas atuais (409 `SCHEDULE_HAS_RECORDS`) → `saveWeeks({ creates: [], replaces: [..] })`
- Produz (fluxo de `replicate`): origem por `findById` (404) → turma → `weekPeriod` + `assertScheduleWeek` por data alvo; alvo igual à semana de origem → 400 `SCHEDULE_INVALID_PERIOD` → disciplinas da origem por `findExistingSubjectIds` → uma chamada `findCalendarCandidates` com todas as datas alvo → uma chamada `findByWeeks` com todas as segundas alvo → por alvo `resolveCalendarDays` + `replicateDays`; com horário existente, `mergeWithRecorded` (sobrescrita, `action: 'OVERWRITTEN'`), senão flags `false` (`action: 'CREATED'`) → `assertSaturdayLessons` no resultado de cada alvo → `saveWeeks` uma vez com todos os `creates` e `replaces`; `discarded` = os de `replicateDays` + os de `mergeWithRecorded`
- Consome: T-05 `WEEKLY_SCHEDULE_REPOSITORY`, `export interface IWeeklyScheduleRepository`, `list(filter: WeeklyScheduleListFilter): Promise<{ data: WeeklyScheduleSummaryRecord[]; total: number }>`, `findById(tenantId: string, id: string): Promise<WeeklyScheduleRecord | null>`, `softDelete(tenantId: string, id: string, deletedById: string): Promise<void>`, `findClass(tenantId: string, schoolClassId: string): Promise<ScheduleClassRecord | null>`, `findExistingSubjectIds(tenantId: string, subjectIds: readonly string[]): Promise<string[]>`, `findCalendarCandidates(tenantId: string, schoolId: string, dates: readonly string[]): Promise<CalendarDayCandidate[]>`, `findByWeeks(tenantId: string, schoolClassId: string, startDates: readonly string[]): Promise<WeeklyScheduleRecord[]>`, `saveWeeks(input: SaveWeeksInput): Promise<SaveWeeksResult>`, `updateLessonRecord(tenantId: string, scheduleId: string, lessonId: string, input: UpdateLessonRecordInput): Promise<WeeklyScheduleLessonRecord | null>`; T-02 `export function weekPeriod(startDate: string): DatePeriod`, `export function assertScheduleWeek(period: DatePeriod, schoolYear: number): void`, `export function normalizePlannedDays(period: DatePeriod, days: readonly PlannedDay[]): PlannedDay[]`, `export function resolveCalendarDays(dates: readonly string[], candidates: readonly CalendarDayCandidate[]): ResolvedCalendarDay[]`, `export function assertDaysMatchCalendar(days: readonly PlannedDay[], calendar: readonly ResolvedCalendarDay[]): void`, `export function assertSaturdayLessons(days: readonly PlannedDay[], calendar: readonly ResolvedCalendarDay[]): void`, `export function replicateDays(source: readonly PlannedDay[], targetDates: readonly string[], calendar: readonly ResolvedCalendarDay[]): { days: PlannedDay[]; discarded: DiscardedLesson[] }`, `export function mergeWithRecorded(replicated: readonly PlannedDay[], existing: readonly DatedLesson[]): { days: FlaggedDay[]; preserved: DatedLesson[]; discarded: DiscardedLesson[] }`, `export function carryLessonRecords(existing: readonly DatedLesson[], planned: readonly PlannedDay[]): FlaggedDay[]`, `SCHEDULE_NOT_FOUND`, `SCHEDULE_LESSON_NOT_FOUND`, `SCHEDULE_SUBJECTS_INVALID`, `SCHEDULE_WEEK_TAKEN`, `SCHEDULE_INVALID_PERIOD`, `SCHEDULE_HAS_RECORDS`, `SCHOOL_CLASS_NOT_FOUND`

**Teste RED**
- `backend/src/modules/weekly-schedules/__tests__/weekly-schedules.service.spec.ts` — falha antes de existir `WeeklySchedulesService`: com `jest.Mocked<IWeeklyScheduleRepository>` e turma `{ id: 'sc1', schoolId: 's1', schoolYear: 2026 }`: (a) semana `2026-09-28`–`2026-10-04`, candidatos com `2026-10-03` `SCHOOL_DAY` `specific: true` e `NON_SCHOOL_DAY` `specific: false`, sem aula no sábado → `create` rejeita com `code: 'SCHEDULE_SATURDAY_WITHOUT_LESSONS'` e `saveWeeks` não é chamado; (b) aula em `2026-10-12` `NON_SCHOOL_DAY` (semana `2026-10-12`–`2026-10-18`) → `code: 'SCHEDULE_LESSON_ON_NON_SCHOOL_DAY'`; (c) `create` com `startDate: '2026-09-27'` (domingo) → `code: 'SCHEDULE_INVALID_PERIOD'`; (d) `create` com `findByWeeks` devolvendo um horário → `code: 'SCHEDULE_WEEK_TAKEN'`; (e) `replicate` da origem `2026-09-28` (aula `08:00–08:50` na segunda) para `['2026-10-12', '2026-10-19', '2026-10-26']`, com `2026-10-12` `NON_SCHOOL_DAY` e `findByWeeks` devolvendo horário em `2026-10-19` com aula `08:20–09:10` `attendanceRecorded: true` → `saveWeeks` chamado uma vez com 2 `creates` e 1 `replace`; resultado de `2026-10-12` com `discarded` `reason: 'NON_SCHOOL_DAY'`, de `2026-10-19` com `action: 'OVERWRITTEN'`, `preserved` com a `08:20` e `discarded` com a `08:00` `reason: 'RECORDED_CONFLICT'`; (f) `replicate` em que o sábado alvo `2026-10-24` é `SCHOOL_DAY` e o resultado não tem aula nele → `code: 'SCHEDULE_SATURDAY_WITHOUT_LESSONS'` e `saveWeeks` não é chamado; (g) `update` que remove aula com `attendanceRecorded: true` → `code: 'SCHEDULE_HAS_RECORDS'` e `saveWeeks` não é chamado; (h) `updateLessonRecord` com o repositório devolvendo `null` → `code: 'SCHEDULE_LESSON_NOT_FOUND'` (fonte das datas: calendário civil — `2026-09-27` é domingo; `2026-10-03` e `2026-10-24` são sábados; `2026-09-28`, `2026-10-12`, `2026-10-19` e `2026-10-26` são segundas) (comando: `cd backend && npx jest src/modules/weekly-schedules/__tests__/weekly-schedules.service.spec.ts`)

**Critério de aceite**
- O spec do service passa com os casos (a)–(h) do Teste RED e os do Review Focus de T-06.
- `WeeklySchedulesModule` compila e não é registrado em `app.module.ts` (é de T-07).
- `npx tsc --noEmit` e `npx eslint "{src,test}/**/*.ts"` em `backend/` com exit 0 e saída vazia.

**Validação**
- `cd backend && npx jest src/modules/weekly-schedules` (evidência: 3 suítes `PASS` — rules, repository, service — e `Tests:` sem `failed`)
- `cd backend && npx jest src/modules/weekly-schedules/__tests__/weekly-schedules.service.spec.ts -t "SATURDAY|OVERWRITTEN|RECORDED_CONFLICT"` — Review Focus: calendário da escola prevalece no sábado; replicação sobrescreve preservando a aula registrada e lista a descartada (evidência: os casos listados como `✓`)
- `cd backend && npx tsc --noEmit && npx eslint "{src,test}/**/*.ts"` (evidência: exit 0, nenhuma linha de saída)

### T-07 — Registro dos módulos, e2e e validação integral

**Camada:** backend
**Dependências:** T-03, T-04, T-06
**Paralelizável:** não
**Complexidade:** simples
**Agente:** Aang

**Arquivos prováveis**
- `backend/src/app.module.ts`
- `backend/test/app.e2e-spec.ts`

**Interface**
- Produz: `SubjectsModule`, `SchoolClassesModule` e `WeeklySchedulesModule` importados em `AppModule` (depois de `AcademicCalendarModule`)
- Consome: T-03 `export class SubjectsModule`; T-04 `export class SchoolClassesModule`; T-06 `export class WeeklySchedulesModule`

**Teste RED**
- `backend/test/app.e2e-spec.ts` — falha antes do registro dos módulos (rota inexistente responde 404, não 403): `GET /subjects`, `GET /school-classes`, `GET /weekly-schedules`, `POST /weekly-schedules/7f0b0a52-2d0a-4a6b-9a5e-2b1d9a1c3e11/replicate` e `PATCH /weekly-schedules/7f0b0a52-2d0a-4a6b-9a5e-2b1d9a1c3e11/lessons/7f0b0a52-2d0a-4a6b-9a5e-2b1d9a1c3e12/record` sem `employee:manage` → 403 `FORBIDDEN_PERMISSION`, no mesmo formato do caso `GET /academic-calendars sem employee:manage` já existente (comando: `cd backend && npm run test:e2e`)

**Critério de aceite**
- `npm run test:e2e` com os 5 casos novos de 403 passando e `Tests:` sem `failed`.
- `npx jest` (suíte unitária inteira) com `Tests:` sem `failed` e as 7 suítes novas como `PASS`.
- `npx tsc --noEmit` e `npx eslint "{src,test}/**/*.ts"` em `backend/` com exit 0 e saída vazia.
- `npm run db:migrate` em banco local imprime `applied: (nenhuma)` (0005 já aplicada em T-01).
- Nenhum commit criado: `git -C /home/kaine/source/geduc-rag log --oneline -1` mostra `206bc5d` e `git status --porcelain` lista só caminhos do Mapa de arquivos e de `.claude/tasks/`.

**Validação**
- `cd backend && npm run test:e2e` (evidência: `Tests:` sem `failed`, os 5 títulos novos com `✓`)
- `cd backend && npx jest` (evidência: `Test Suites:` sem `failed`; `PASS` para `weekly-schedule.rules`, `subject.repository`, `subjects.service`, `school-class.repository`, `school-classes.service`, `weekly-schedule.repository`, `weekly-schedules.service`)
- `cd backend && npx tsc --noEmit && npx eslint "{src,test}/**/*.ts"` (evidência: exit 0, nenhuma linha de saída)
- `cd backend && npm run db:migrate` (evidência: `db:migrate em localhost` e `applied: (nenhuma)`)
- `git -C /home/kaine/source/geduc-rag log --oneline -1 && git -C /home/kaine/source/geduc-rag status --porcelain` (evidência: `206bc5d` e só caminhos de `backend/` do Mapa de arquivos e de `.claude/tasks/`)
- `mysql -h 127.0.0.1 -P 3307 -u rag -prag geduc_rag -e "SELECT (SELECT COUNT(*) FROM tenant) t, (SELECT COUNT(*) FROM school) s, (SELECT COUNT(*) FROM academic_calendar_day) d"` (evidência: números iguais aos anotados no relatório de T-01)

## Legenda

- [ ] pendente
- [~] em andamento
- [x] concluído com evidência
- [!] bloqueado
