# Tasks

| ID | Camada | Descrição | Dependências | Paralelizável | Complexidade | Agente | Status |
|---|---|---|---|---|---|---|---|
| T-01 | database | Migration `0004_academic_calendar.sql` (escola, calendário, vínculo, dias) | — | sim | média | Athena | [x] |
| T-02 | backend | Códigos de erro novos + regras puras do calendário (`academic-calendar.rules.ts`) | — | sim | média | Arquimedes | [x] |
| T-03 | backend | Repositório SQL de escolas (interface, repositório, query de listagem) | T-01 | sim | simples | Levi | [x] |
| T-04 | backend | Repositório SQL do calendário (calendário, vínculos com escolas, dias, contagem por tipo) | T-01, T-02 | sim | alta | Saitama | [x] |
| T-05 | backend | Service, DTOs, controller e module de escolas (`/schools`) | T-02, T-03 | sim | média | Platão | [x] |
| T-06 | backend | Service, DTOs, controller e module do calendário (`/academic-calendars`, visões, dias) | T-02, T-04 | sim | alta | Jaspion | [x] |
| T-07 | backend | Registro dos módulos em `app.module.ts`, e2e de permissão e validação integral | T-05, T-06 | não | simples | Aang | [x] |

## Detalhamento

### T-01 — Migration `0004_academic_calendar.sql`

**Camada:** database
**Dependências:** nenhuma
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Athena

**Arquivos prováveis**
- `backend/database/migrations/0004_academic_calendar.sql`

**Interface**
- Produz: `school(id, tenant_id, name, active, created_at, updated_at, deleted_at, created_by_id, updated_by_id, deleted_by_id)` com `UNIQUE INDEX school_tenant_id_name_key(tenant_id, name)` e `INDEX school_tenant_id_active_idx(tenant_id, active)`
- Produz: `academic_calendar(id, tenant_id, school_year, name, start_date, end_date, all_schools, created_at, updated_at, deleted_at, created_by_id, updated_by_id, deleted_by_id)` — `school_year SMALLINT NOT NULL`, `start_date DATE NOT NULL`, `end_date DATE NOT NULL`, `all_schools BOOLEAN NOT NULL DEFAULT false`, `INDEX academic_calendar_tenant_id_school_year_idx(tenant_id, school_year)`
- Produz: `academic_calendar_school(calendar_id, school_id)` — `PRIMARY KEY (calendar_id, school_id)`, `INDEX academic_calendar_school_school_id_idx(school_id)`, FKs `ON DELETE CASCADE` (tabela de junção)
- Produz: `academic_calendar_day(id, tenant_id, calendar_id, day_date, day_type, description, created_at, updated_at, updated_by_id)` — `day_date DATE NOT NULL`, `day_type ENUM('SCHOOL_DAY','NON_SCHOOL_DAY','OPTIONAL_DAY','LESSON_PLANNING','TEACHER_TRAINING') NOT NULL`, `description TEXT NULL`, `UNIQUE INDEX academic_calendar_day_calendar_id_day_date_key(calendar_id, day_date)`, `INDEX academic_calendar_day_tenant_id_calendar_id_day_date_idx(tenant_id, calendar_id, day_date)`, FK `calendar_id` `ON DELETE CASCADE` (filha pura)
- Convenções (de `0003_employee.sql`): `id`/FKs `VARCHAR(191)`, `created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)`, `updated_at DATETIME(3) NOT NULL`, `deleted_at DATETIME(3) NULL`, `DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`; `tenant_id` → `tenant(id)` `ON DELETE RESTRICT ON UPDATE CASCADE`; `created_by_id`/`updated_by_id` → `user(id)` `ON DELETE SET NULL`. Constraint nomeadas `<tabela>_<coluna>_fkey`.
- Consome: nada

**Teste RED**
- sem teste: migration pura (DDL), validada por `npm run db:migrate` em banco local

**Critério de aceite**
- `npm run db:migrate` imprime `db:migrate em localhost` (ou `127.0.0.1`) e `applied: 0004_academic_calendar`; uma segunda execução imprime `applied: (nenhuma)`.
- `SHOW TABLES` lista `school`, `academic_calendar`, `academic_calendar_school` e `academic_calendar_day`.
- As contagens de `tenant`, `user` e `employee` antes e depois da migration são idênticas.

**Validação**
- `cd backend && mysql -h 127.0.0.1 -P 3307 -u rag -prag geduc_rag -e "SELECT (SELECT COUNT(*) FROM tenant) t, (SELECT COUNT(*) FROM user) u, (SELECT COUNT(*) FROM employee) e"` antes da migration (evidência: os três números, anotados no relatório)
- `cd backend && npm run db:migrate` (evidência: linhas `db:migrate em localhost` e `applied: 0004_academic_calendar`); repetir (evidência: `applied: (nenhuma)`)
- `mysql -h 127.0.0.1 -P 3307 -u rag -prag geduc_rag -e "SHOW TABLES LIKE '%school%'; SHOW TABLES LIKE 'academic_calendar%'; SHOW CREATE TABLE academic_calendar_day\G"` (evidência: as 4 tabelas e a linha `day_type enum('SCHOOL_DAY','NON_SCHOOL_DAY','OPTIONAL_DAY','LESSON_PLANNING','TEACHER_TRAINING')`)
- A mesma consulta de contagem depois da migration (evidência: `t`, `u`, `e` iguais aos de antes)

### T-02 — Códigos de erro novos + regras puras do calendário

**Camada:** backend
**Dependências:** nenhuma
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Arquimedes

**Arquivos prováveis**
- `backend/src/common/errors/error-codes.ts`
- `backend/src/modules/academic-calendar/academic-calendar.rules.ts`
- `backend/src/modules/academic-calendar/__tests__/academic-calendar.rules.spec.ts`

**Interface**
- Produz (em `ERROR_CODES`, seção nova "Escolas" e "Calendário acadêmico", com comentário de status como as demais): `SCHOOL_NOT_FOUND` (404), `SCHOOL_NAME_TAKEN` (409), `CALENDAR_NOT_FOUND` (404), `CALENDAR_DAY_NOT_FOUND` (404), `CALENDAR_INVALID_RANGE` (400), `CALENDAR_SCHOOLS_INVALID` (400), `CALENDAR_SUNDAY_IMMUTABLE` (400) — valor de cada chave = o próprio nome
- Produz (em `academic-calendar.rules.ts`): `export const DAY_TYPES = ['SCHOOL_DAY', 'NON_SCHOOL_DAY', 'OPTIONAL_DAY', 'LESSON_PLANNING', 'TEACHER_TRAINING'] as const`, `export type DayType = (typeof DAY_TYPES)[number]`, `export const CALENDAR_VIEWS = ['day', 'week', 'month', 'year'] as const`, `export type CalendarView = (typeof CALENDAR_VIEWS)[number]`
- Produz: `export interface GeneratedDay { date: string; type: DayType }`, `export interface DayTypeCount { type: DayType; total: number }`, `export type DayTypeTotals = Record<DayType, number> & { total: number }`, `export interface DatePeriod { startDate: string; endDate: string }` — toda data é texto `YYYY-MM-DD`
- Produz: `export function weekdayOf(date: string): number` (0 = domingo … 6 = sábado, calculado em UTC: `new Date(date + 'T00:00:00Z').getUTCDay()`)
- Produz: `export function defaultDayType(date: string): DayType` (domingo e sábado → `NON_SCHOOL_DAY`; segunda a sexta → `SCHOOL_DAY`)
- Produz: `export function assertCalendarRange(year: number, startDate: string, endDate: string): void` — lança `BadRequestException({ code: ERROR_CODES.CALENDAR_INVALID_RANGE, message })` se `startDate > endDate` ou se alguma das datas não começa com `year`
- Produz: `export function buildCalendarDays(startDate: string, endDate: string): GeneratedDay[]` — um item por dia, inclusivo nas duas pontas, ordem crescente, `type = defaultDayType(date)`
- Produz: `export function resolvePeriod(view: CalendarView, date: string): DatePeriod` — `day` = a data; `week` = domingo a sábado que contém a data; `month` = primeiro ao último dia do mês; `year` = `AAAA-01-01` a `AAAA-12-31`
- Produz: `export function totalsFromCounts(counts: readonly DayTypeCount[]): DayTypeTotals` (todas as 5 chaves presentes, ausentes = 0; `total` = soma) e `export function countByType(types: readonly DayType[]): DayTypeTotals`
- Produz: `export function assertDayTypeChangeAllowed(date: string, type: DayType | undefined): void` — lança `BadRequestException({ code: ERROR_CODES.CALENDAR_SUNDAY_IMMUTABLE, message })` quando `weekdayOf(date) === 0` e `type !== undefined && type !== 'NON_SCHOOL_DAY'`; não lança nos demais casos
- Consome: nada

**Teste RED**
- `backend/src/modules/academic-calendar/__tests__/academic-calendar.rules.spec.ts` — falha antes de existir `academic-calendar.rules.ts`: `buildCalendarDays('2026-02-01', '2026-02-07')` devolve 7 dias com `2026-02-01` (domingo) e `2026-02-07` (sábado) `NON_SCHOOL_DAY` e os 5 do meio `SCHOOL_DAY`; `resolvePeriod('week', '2026-02-04')` = `{ startDate: '2026-02-01', endDate: '2026-02-07' }`; `resolvePeriod('month', '2028-02-10')` termina em `2028-02-29`; `countByType(buildCalendarDays('2026-01-01', '2026-12-31').map((d) => d.type))` = `SCHOOL_DAY: 261`, `NON_SCHOOL_DAY: 104`, demais `0`, `total: 365`; `assertDayTypeChangeAllowed('2026-02-01', 'SCHOOL_DAY')` lança com `code: 'CALENDAR_SUNDAY_IMMUTABLE'` e `assertDayTypeChangeAllowed('2026-02-07', 'SCHOOL_DAY')` não lança; `assertCalendarRange(2026, '2026-12-31', '2027-01-02')` lança `CALENDAR_INVALID_RANGE` (fonte das datas: calendário civil — 2026-02-01 é domingo; 2026 tem 52 domingos e 52 sábados; 2028 é bissexto) (comando: `cd backend && npx jest src/modules/academic-calendar/__tests__/academic-calendar.rules.spec.ts`)

**Critério de aceite**
- O spec de regras passa com todos os casos do Teste RED e as 7 chaves novas existem em `ERROR_CODES`.
- `npx tsc --noEmit` e `npx eslint "{src,test}/**/*.ts"` em `backend/` terminam com exit 0 e saída vazia.

**Validação**
- `cd backend && npx jest src/modules/academic-calendar/__tests__/academic-calendar.rules.spec.ts` (evidência: `PASS` e `Tests:` sem `failed`)
- `cd backend && npx tsc --noEmit && npx eslint "{src,test}/**/*.ts"` (evidência: exit 0, nenhuma linha de saída)
- `grep -c "CALENDAR_\|SCHOOL_" backend/src/common/errors/error-codes.ts` (evidência: as 7 chaves presentes)

### T-03 — Repositório SQL de escolas

**Camada:** backend
**Dependências:** T-01
**Paralelizável:** sim
**Complexidade:** simples
**Agente:** Levi

**Arquivos prováveis**
- `backend/src/modules/schools/application/interface/repository/school.repository.interface.ts`
- `backend/src/modules/schools/infra/database/repositories/school.repository.ts`
- `backend/src/modules/schools/infra/database/queries/school-list.query.ts`
- `backend/src/modules/schools/__tests__/school.repository.spec.ts`

**Interface**
- Produz: `export const SCHOOL_REPOSITORY = 'ISchoolRepository'`
- Produz: `export interface SchoolRecord { id: string; tenantId: string; name: string; active: boolean; createdAt: Date; updatedAt: Date }`, `export interface SchoolListFilter { tenantId: string; active?: boolean; search?: string; page: number; limit: number }`, `export interface CreateSchoolInput { tenantId: string; name: string; active: boolean; createdById: string }`, `export interface UpdateSchoolInput { name?: string; active?: boolean; updatedById: string }`
- Produz: `export interface ISchoolRepository` com `list(filter: SchoolListFilter): Promise<{ data: SchoolRecord[]; total: number }>` (não excluídas, ordem `s.name ASC, s.id ASC`, busca parcial em `s.name`), `findById(tenantId: string, id: string): Promise<SchoolRecord | null>` (ignora excluída), `findIdByName(tenantId: string, name: string): Promise<string | null>` (não filtra exclusão: o unique também não), `create(input: CreateSchoolInput): Promise<SchoolRecord>`, `update(tenantId: string, id: string, input: UpdateSchoolInput): Promise<SchoolRecord>`, `softDelete(tenantId: string, id: string, deletedById: string): Promise<void>` (`active = 0`, `deleted_at = NOW(3)`)
- Produz: `export class SchoolRepository implements ISchoolRepository` com `constructor(private readonly db: IDatabaseConnection)`; alias de tabela `s` (`SCHOOL_FROM = 'school s'`)
- Consome: T-01 `school(id, tenant_id, name, active, created_at, updated_at, deleted_at, created_by_id, updated_by_id, deleted_by_id)`

**Teste RED**
- `backend/src/modules/schools/__tests__/school.repository.spec.ts` — falha antes de existir `SchoolRepository`: com a conexão falsa de `employee.repository.spec.ts` (`makeConnection`), `list` emite SQL com `s.tenant_id = ?`, `s.deleted_at IS NULL` e `ORDER BY s.name ASC, s.id ASC` e devolve `total` numérico; `findIdByName('t1', 'Escola A')` emite `SELECT id FROM school WHERE tenant_id = ? AND name = ?` com params `['t1', 'Escola A']`; `create` roda em `runInTransaction` com `INSERT INTO school` e `NOW(3)`; `softDelete` emite `UPDATE school` com `deleted_at = NOW(3)` e `WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL` (comando: `cd backend && npx jest src/modules/schools/__tests__/school.repository.spec.ts`)

**Critério de aceite**
- O spec do repositório de escolas passa; nenhuma query do repositório usa `SELECT *` nem interpola valor (todo valor em `?`/`:nome`).
- `npx tsc --noEmit` em `backend/` com exit 0 e saída vazia.

**Validação**
- `cd backend && npx jest src/modules/schools/__tests__/school.repository.spec.ts` (evidência: `PASS`, `Tests:` sem `failed`)
- `cd backend && npx tsc --noEmit && npx eslint src/modules/schools` (evidência: exit 0, nenhuma linha de saída)
- `grep -n "SELECT \*" backend/src/modules/schools -r` (evidência: nenhuma linha)

### T-04 — Repositório SQL do calendário

**Camada:** backend
**Dependências:** T-01, T-02
**Paralelizável:** sim
**Complexidade:** alta
**Agente:** Saitama

**Arquivos prováveis**
- `backend/src/modules/academic-calendar/application/interface/repository/academic-calendar.repository.interface.ts`
- `backend/src/modules/academic-calendar/infra/database/repositories/academic-calendar.repository.ts`
- `backend/src/modules/academic-calendar/infra/database/queries/academic-calendar-list.query.ts`
- `backend/src/modules/academic-calendar/__tests__/academic-calendar.repository.spec.ts`

**Interface**
- Produz: `export const ACADEMIC_CALENDAR_REPOSITORY = 'IAcademicCalendarRepository'`
- Produz: `export interface AcademicCalendarRecord { id: string; tenantId: string; year: number; name: string; startDate: string; endDate: string; allSchools: boolean; schoolIds: string[]; createdAt: Date; updatedAt: Date }` (`schoolIds` só de escolas não excluídas, ordem crescente; `[]` quando `allSchools`)
- Produz: `export interface CalendarDayRecord { date: string; type: DayType; description: string | null; updatedAt: Date }`
- Produz: `export interface AcademicCalendarListFilter { tenantId: string; year?: number; schoolId?: string; page: number; limit: number }` (`schoolId` casa calendário com `all_schools = 1` ou com vínculo à escola não excluída)
- Produz: `export interface CreateAcademicCalendarInput { tenantId: string; year: number; name: string; startDate: string; endDate: string; allSchools: boolean; schoolIds: string[]; days: GeneratedDay[]; createdById: string }`, `export interface UpdateAcademicCalendarInput { name?: string; allSchools?: boolean; schoolIds?: string[]; updatedById: string }` (`schoolIds` definido = substitui todos os vínculos), `export interface UpdateCalendarDayInput { type?: DayType; description?: string | null; updatedById: string }`
- Produz: `export interface IAcademicCalendarRepository` com `list(filter: AcademicCalendarListFilter): Promise<{ data: AcademicCalendarRecord[]; total: number }>` (ordem `c.school_year DESC, c.name ASC, c.id ASC`), `findById(tenantId: string, id: string): Promise<AcademicCalendarRecord | null>`, `findExistingSchoolIds(tenantId: string, schoolIds: readonly string[]): Promise<string[]>` (lista vazia → `[]` sem SQL), `create(input: CreateAcademicCalendarInput): Promise<AcademicCalendarRecord>`, `update(tenantId: string, id: string, input: UpdateAcademicCalendarInput): Promise<AcademicCalendarRecord>`, `softDelete(tenantId: string, id: string, deletedById: string): Promise<void>`, `listDays(tenantId: string, calendarId: string, period: DatePeriod): Promise<CalendarDayRecord[]>` (ordem `d.day_date ASC`), `findDay(tenantId: string, calendarId: string, date: string): Promise<CalendarDayRecord | null>`, `updateDay(tenantId: string, calendarId: string, date: string, input: UpdateCalendarDayInput): Promise<CalendarDayRecord>`, `countDaysByType(tenantId: string, calendarId: string): Promise<DayTypeCount[]>`
- Produz: `export class AcademicCalendarRepository implements IAcademicCalendarRepository` com `constructor(private readonly db: IDatabaseConnection)`; datas lidas com `DATE_FORMAT(<coluna>, '%Y-%m-%d')`; `create` numa transação (INSERT do calendário, `INSERT INTO academic_calendar_school (calendar_id, school_id) VALUES ?` quando há escolas, `INSERT INTO academic_calendar_day (...) VALUES ?` em lote único); `schoolIds` da página carregados numa só query `IN (?)`
- Consome: T-01 `academic_calendar(id, tenant_id, school_year, name, start_date, end_date, all_schools, created_at, updated_at, deleted_at, created_by_id, updated_by_id, deleted_by_id)`, `academic_calendar_school(calendar_id, school_id)`, `academic_calendar_day(id, tenant_id, calendar_id, day_date, day_type, description, created_at, updated_at, updated_by_id)`; T-02 `export type DayType = (typeof DAY_TYPES)[number]`, `export interface GeneratedDay { date: string; type: DayType }`, `export interface DayTypeCount { type: DayType; total: number }`, `export interface DatePeriod { startDate: string; endDate: string }`

**Teste RED**
- `backend/src/modules/academic-calendar/__tests__/academic-calendar.repository.spec.ts` — falha antes de existir `AcademicCalendarRepository`: com conexão falsa no molde de `makeConnection` (`employee.repository.spec.ts`), `create` com `days: buildCalendarDays('2026-02-01', '2026-02-07')` e `schoolIds: ['s1']` emite, dentro da transação, um único `INSERT INTO academic_calendar_day` com `VALUES ?` cujo parâmetro tem 7 linhas, e um `INSERT INTO academic_calendar_school`; `listDays('t1', 'c1', { startDate: '2026-02-01', endDate: '2026-02-07' })` emite SQL com `DATE_FORMAT(d.day_date, '%Y-%m-%d')`, `d.tenant_id = ?` e `BETWEEN ? AND ?` e mapeia `day_type` para `type`; `findExistingSchoolIds('t1', [])` devolve `[]` sem chamar `query`; `list` com 2 calendários na página faz uma só query de vínculos com `IN (?)`; `countDaysByType` emite `GROUP BY d.day_type` e converte `total` para número (comando: `cd backend && npx jest src/modules/academic-calendar/__tests__/academic-calendar.repository.spec.ts`)

**Critério de aceite**
- O spec do repositório do calendário passa; toda query filtra `tenant_id` (diretamente ou pelo join com `academic_calendar`), nenhuma usa `SELECT *` e nenhuma roda dentro de `for`/`map`.
- `npx tsc --noEmit` em `backend/` com exit 0 e saída vazia.

**Validação**
- `cd backend && npx jest src/modules/academic-calendar/__tests__/academic-calendar.repository.spec.ts` (evidência: `PASS`, `Tests:` sem `failed`)
- `cd backend && npx tsc --noEmit && npx eslint src/modules/academic-calendar` (evidência: exit 0, nenhuma linha de saída)
- `grep -rn "SELECT \*" backend/src/modules/academic-calendar` (evidência: nenhuma linha)
- Review Focus: caso no spec em que a linha do banco traz `date: '2026-02-01'` (texto vindo do `DATE_FORMAT`) e o record sai com `date: '2026-02-01'`; caso de `list` com `schoolId` cujo SQL contém `s.deleted_at IS NULL` no `EXISTS` e a query de vínculos filtra escola excluída

### T-05 — Service, DTOs, controller e module de escolas

**Camada:** backend
**Dependências:** T-02, T-03
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Platão

**Arquivos prováveis**
- `backend/src/modules/schools/dto/school.dto.ts`
- `backend/src/modules/schools/schools.service.ts`
- `backend/src/modules/schools/schools.controller.ts`
- `backend/src/modules/schools/schools.module.ts`
- `backend/src/modules/schools/__tests__/schools.service.spec.ts`

**Interface**
- Produz: rotas `GET /schools` (200 `SchoolListResponseDto`), `GET /schools/:id` (200 `SchoolResponseDto`), `POST /schools` (201 `SchoolResponseDto`), `PATCH /schools/:id` (200 `SchoolResponseDto`), `DELETE /schools/:id` (204) — controller com `@TenantScoped()`, `@ApiTags('schools')`, `@ApiBearerAuth()` e `@RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)` em todas as rotas; `:id` com `ParseUUIDPipe`
- Produz: `export class CreateSchoolDto { name: string; active?: boolean }` (`name` `@IsString() @MinLength(2) @MaxLength(191)`; `active` `@IsOptionalNotNull() @IsBoolean()`), `export class UpdateSchoolDto extends PartialType(CreateSchoolDto, UPDATE_DTO_PARTIAL_OPTS)`, `export class ListSchoolsDto extends PaginationQueryDto { search?: string; active?: boolean }`, `export class SchoolResponseDto { id: string; tenantId: string; name: string; active: boolean; createdAt: Date; updatedAt: Date }`, `export class SchoolListResponseDto { data: SchoolResponseDto[]; total: number }`
- Produz: `export class SchoolsService` com `list(tenantId: string, query: ListSchoolsDto): Promise<SchoolListResponseDto>` (page 1, limit 20 por padrão), `findOne(tenantId: string, id: string): Promise<SchoolResponseDto>`, `create(tenantId: string, dto: CreateSchoolDto, actorId: string): Promise<SchoolResponseDto>` (nome com `trim()`, `active` padrão `true`), `update(tenantId: string, id: string, dto: UpdateSchoolDto, actorId: string): Promise<SchoolResponseDto>`, `remove(tenantId: string, id: string, actorId: string): Promise<void>`; inexistente/excluída/de outro tenant → 404 `SCHOOL_NOT_FOUND`; nome já usado por outra escola do tenant (inclusive excluída, ou corrida detectada por `isMysqlDuplicateEntry`) → 409 `SCHOOL_NAME_TAKEN`
- Produz: `export class SchoolsModule` (provider `{ provide: SCHOOL_REPOSITORY, inject: [DATABASE_CONNECTION], useFactory: (db: IDatabaseConnection) => new SchoolRepository(db) }` + `SchoolsService`, controller `SchoolsController`)
- Consome: T-03 `export const SCHOOL_REPOSITORY = 'ISchoolRepository'`, `export interface ISchoolRepository`, `export class SchoolRepository implements ISchoolRepository`, `findIdByName(tenantId: string, name: string): Promise<string | null>`; T-02 `SCHOOL_NOT_FOUND`, `SCHOOL_NAME_TAKEN`

**Teste RED**
- `backend/src/modules/schools/__tests__/schools.service.spec.ts` — falha antes de existir `SchoolsService`: com repositório `jest.Mocked<ISchoolRepository>` (molde de `employees.service.spec.ts`), `create('t1', { name: '  Escola A  ' }, 'u1')` chama `repository.create` com `{ tenantId: 't1', name: 'Escola A', active: true, createdById: 'u1' }`; com `findIdByName` resolvendo `'s2'`, `create` rejeita `ConflictException` com `code: 'SCHOOL_NAME_TAKEN'`; `update('t1', 's2', { name: 'Escola A' }, 'u1')` com `findIdByName` → `'s2'` (a própria) não rejeita; `findOne` com `findById` → `null` rejeita `NotFoundException` com `code: 'SCHOOL_NOT_FOUND'`; `remove` chama `softDelete('t1', 's1', 'u1')` (comando: `cd backend && npx jest src/modules/schools/__tests__/schools.service.spec.ts`)

**Critério de aceite**
- O spec do service de escolas passa com os casos do Teste RED.
- `npx tsc --noEmit` e `npx eslint src/modules/schools` em `backend/` com exit 0 e saída vazia.
- `grep -c "PERMISSIONS.EMPLOYEE_MANAGE" backend/src/modules/schools/schools.controller.ts` imprime `5`.

**Validação**
- `cd backend && npx jest src/modules/schools` (evidência: 2 suítes `PASS`, `Tests:` sem `failed`)
- `cd backend && npx tsc --noEmit && npx eslint src/modules/schools` (evidência: exit 0, nenhuma linha de saída)
- `grep -c "PERMISSIONS.EMPLOYEE_MANAGE" backend/src/modules/schools/schools.controller.ts` (evidência: `5`)

### T-06 — Service, DTOs, controller e module do calendário

**Camada:** backend
**Dependências:** T-02, T-04
**Paralelizável:** sim
**Complexidade:** alta
**Agente:** Jaspion

**Arquivos prováveis**
- `backend/src/modules/academic-calendar/dto/academic-calendar.dto.ts`
- `backend/src/modules/academic-calendar/academic-calendar.service.ts`
- `backend/src/modules/academic-calendar/academic-calendar.controller.ts`
- `backend/src/modules/academic-calendar/academic-calendar.module.ts`
- `backend/src/modules/academic-calendar/__tests__/academic-calendar.service.spec.ts`

**Interface**
- Produz: rotas (controller com `@TenantScoped()`, `@ApiTags('academic-calendars')`, `@ApiBearerAuth()`, `@Controller('academic-calendars')` e `@RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)` em todas): `GET /academic-calendars` (200 `AcademicCalendarListResponseDto`), `GET /academic-calendars/:id` (200 `AcademicCalendarDetailResponseDto`), `POST /academic-calendars` (201 `AcademicCalendarDetailResponseDto`), `PATCH /academic-calendars/:id` (200 `AcademicCalendarDetailResponseDto`), `DELETE /academic-calendars/:id` (204), `GET /academic-calendars/:id/days?view=<day|week|month|year>&date=YYYY-MM-DD` (200 `CalendarDaysResponseDto`), `PATCH /academic-calendars/:id/days/:date` (200 `CalendarDayResponseDto`); `:id` com `ParseUUIDPipe`; `:date` validado como `YYYY-MM-DD` (`@Matches(/^\d{4}-\d{2}-\d{2}$/)` + `@IsDateString({ strict: true })`, 400 se malformado)
- Produz: `export class CreateAcademicCalendarDto { year: number; name: string; startDate: string; endDate: string; allSchools: boolean; schoolIds?: string[] }` (`year` `@IsInt() @Min(2000) @Max(2100)`; `name` 2–191; datas `YYYY-MM-DD`; `schoolIds` `@IsUUID('all', { each: true }) @ArrayUnique()`), `export class UpdateAcademicCalendarDto { name?: string; allSchools?: boolean; schoolIds?: string[] }`, `export class ListAcademicCalendarsDto extends PaginationQueryDto { year?: number; schoolId?: string }`, `export class CalendarDaysQueryDto { view: CalendarView; date: string }` (`@IsIn(CALENDAR_VIEWS)`), `export class UpdateCalendarDayDto { type?: DayType; description?: string | null }` (`type` `@IsOptionalNotNull() @IsIn(DAY_TYPES)`; `description` `@IsOptional() @IsString() @MaxLength(1000)`, vazio após `trim()` vira `null`)
- Produz: `export class DayTypeTotalsDto { SCHOOL_DAY: number; NON_SCHOOL_DAY: number; OPTIONAL_DAY: number; LESSON_PLANNING: number; TEACHER_TRAINING: number; total: number }`, `export class AcademicCalendarResponseDto { id: string; tenantId: string; year: number; name: string; startDate: string; endDate: string; allSchools: boolean; schoolIds: string[]; createdAt: Date; updatedAt: Date }`, `export class AcademicCalendarDetailResponseDto extends AcademicCalendarResponseDto { totals: DayTypeTotalsDto }`, `export class AcademicCalendarListResponseDto { data: AcademicCalendarResponseDto[]; total: number }`, `export class CalendarDayResponseDto { date: string; weekday: number; type: DayType; description: string | null; updatedAt: Date }`, `export class CalendarDaysResponseDto { calendarId: string; view: CalendarView; startDate: string; endDate: string; days: CalendarDayResponseDto[]; totals: DayTypeTotalsDto }`
- Produz: `export class AcademicCalendarService` com `list(tenantId: string, query: ListAcademicCalendarsDto): Promise<AcademicCalendarListResponseDto>`, `findOne(tenantId: string, id: string): Promise<AcademicCalendarDetailResponseDto>` (`totals = totalsFromCounts(await countDaysByType(...))`), `create(tenantId: string, dto: CreateAcademicCalendarDto, actorId: string): Promise<AcademicCalendarDetailResponseDto>` (`assertCalendarRange` → validação de escolas → `repository.create` com `days: buildCalendarDays(startDate, endDate)`; `totals = countByType(days.map((d) => d.type))`), `update(tenantId: string, id: string, dto: UpdateAcademicCalendarDto, actorId: string): Promise<AcademicCalendarDetailResponseDto>`, `remove(tenantId: string, id: string, actorId: string): Promise<void>`, `listDays(tenantId: string, id: string, query: CalendarDaysQueryDto): Promise<CalendarDaysResponseDto>` (período = `resolvePeriod(view, date)`; `totals = countByType` dos dias devolvidos), `updateDay(tenantId: string, id: string, date: string, dto: UpdateCalendarDayDto, actorId: string): Promise<CalendarDayResponseDto>`
- Produz (regras de escolas, em create e update): `allSchools` efetivo = `dto.allSchools ?? atual`; `schoolIds` efetivo = `[]` se `allSchools`, senão `dto.schoolIds ?? atual`; rejeita 400 `CALENDAR_SCHOOLS_INVALID` se `allSchools` e `dto.schoolIds` não vazio, se não `allSchools` e lista efetiva vazia, ou se `findExistingSchoolIds` devolve menos ids que a lista; `update` repassa `schoolIds` efetivo ao repositório sempre que `allSchools` ou `schoolIds` vieram no DTO
- Produz (erros): calendário inexistente/excluído/de outro tenant → 404 `CALENDAR_NOT_FOUND`; dia fora do calendário → 404 `CALENDAR_DAY_NOT_FOUND`; domingo com `type` diferente de `NON_SCHOOL_DAY` → 400 `CALENDAR_SUNDAY_IMMUTABLE` (via `assertDayTypeChangeAllowed`, antes de qualquer escrita)
- Produz: `export class AcademicCalendarModule` (provider `{ provide: ACADEMIC_CALENDAR_REPOSITORY, inject: [DATABASE_CONNECTION], useFactory: (db: IDatabaseConnection) => new AcademicCalendarRepository(db) }` + `AcademicCalendarService`, controller `AcademicCalendarController`)
- Consome: T-04 `export const ACADEMIC_CALENDAR_REPOSITORY = 'IAcademicCalendarRepository'`, `export interface IAcademicCalendarRepository`, `export class AcademicCalendarRepository implements IAcademicCalendarRepository`, `findExistingSchoolIds(tenantId: string, schoolIds: readonly string[]): Promise<string[]>`, `countDaysByType(tenantId: string, calendarId: string): Promise<DayTypeCount[]>`; T-02 `export function buildCalendarDays(startDate: string, endDate: string): GeneratedDay[]`, `export function resolvePeriod(view: CalendarView, date: string): DatePeriod`, `export function countByType(types: readonly DayType[]): DayTypeTotals`, `export function totalsFromCounts(counts: readonly DayTypeCount[]): DayTypeTotals`, `export function assertCalendarRange(year: number, startDate: string, endDate: string): void`, `export function assertDayTypeChangeAllowed(date: string, type: DayType | undefined): void`, `export function weekdayOf(date: string): number`, `CALENDAR_NOT_FOUND`, `CALENDAR_DAY_NOT_FOUND`, `CALENDAR_SCHOOLS_INVALID`

**Teste RED**
- `backend/src/modules/academic-calendar/__tests__/academic-calendar.service.spec.ts` — falha antes de existir `AcademicCalendarService`: com `jest.Mocked<IAcademicCalendarRepository>`, `create('t1', { year: 2026, name: 'Calendário 2026', startDate: '2026-02-01', endDate: '2026-02-07', allSchools: true }, 'u1')` chama `repository.create` com `schoolIds: []` e `days` de 7 itens (primeiro `{ date: '2026-02-01', type: 'NON_SCHOOL_DAY' }`) e devolve `totals` `{ SCHOOL_DAY: 5, NON_SCHOOL_DAY: 2, OPTIONAL_DAY: 0, LESSON_PLANNING: 0, TEACHER_TRAINING: 0, total: 7 }`; `create` com `allSchools: false`, `schoolIds: ['s1', 's2']` e `findExistingSchoolIds` → `['s1']` rejeita `BadRequestException` com `code: 'CALENDAR_SCHOOLS_INVALID'` sem chamar `repository.create`; `updateDay('t1', 'c1', '2026-02-01', { type: 'SCHOOL_DAY' }, 'u1')` rejeita com `code: 'CALENDAR_SUNDAY_IMMUTABLE'` sem chamar `repository.updateDay`; `updateDay('t1', 'c1', '2026-02-07', { type: 'SCHOOL_DAY' }, 'u1')` chama `repository.updateDay`; `listDays('t1', 'c1', { view: 'week', date: '2026-02-04' })` chama `repository.listDays` com `{ startDate: '2026-02-01', endDate: '2026-02-07' }` (datas: 2026-02-01 é domingo, 2026-02-07 é sábado) (comando: `cd backend && npx jest src/modules/academic-calendar/__tests__/academic-calendar.service.spec.ts`)

**Critério de aceite**
- O spec do service do calendário passa com os casos do Teste RED e os do Review Focus abaixo.
- `npx tsc --noEmit` e `npx eslint src/modules/academic-calendar` em `backend/` com exit 0 e saída vazia.
- `grep -c "PERMISSIONS.EMPLOYEE_MANAGE" backend/src/modules/academic-calendar/academic-calendar.controller.ts` imprime `7`.

**Validação**
- `cd backend && npx jest src/modules/academic-calendar` (evidência: 3 suítes `PASS`, `Tests:` sem `failed`)
- `cd backend && npx tsc --noEmit && npx eslint src/modules/academic-calendar` (evidência: exit 0, nenhuma linha de saída)
- `grep -c "PERMISSIONS.EMPLOYEE_MANAGE" backend/src/modules/academic-calendar/academic-calendar.controller.ts` (evidência: `7`)
- Review Focus: casos no spec — `update('t1', 'c1', { allSchools: true }, 'u1')` num calendário com `schoolIds: ['s1']` chama `repository.update` com `schoolIds: []`; `create` com `allSchools: false` e escola de outro tenant/excluída (`findExistingSchoolIds` → `[]`) rejeita `CALENDAR_SCHOOLS_INVALID`; `updateDay` em domingo com `{ description: 'Feriado' }` (sem `type`) chama `repository.updateDay`

### T-07 — Registro dos módulos, e2e de permissão e validação integral

**Camada:** backend
**Dependências:** T-05, T-06
**Paralelizável:** não
**Complexidade:** simples
**Agente:** Aang

**Arquivos prováveis**
- `backend/src/app.module.ts`
- `backend/test/app.e2e-spec.ts`

**Interface**
- Produz: nada (só registra `SchoolsModule` e `AcademicCalendarModule` no bloco "Plataforma" de `imports`, depois de `EmployeesModule`)
- Consome: T-05 `export class SchoolsModule`; T-06 `export class AcademicCalendarModule`

**Teste RED**
- `backend/test/app.e2e-spec.ts` — falha antes do registro (rota inexistente responde 404): com o stub atual (sem `employee:manage`) e `tenant-id: TENANT`, `GET /schools`, `GET /academic-calendars` e `PATCH /academic-calendars/7f0b0a52-2d0a-4a6b-9a5e-2b1d9a1c3e11/days/2026-02-01` respondem 403 com `code: 'FORBIDDEN_PERMISSION'` (molde do caso `GET /employees sem employee:read` do mesmo arquivo) (comando: `cd backend && npm run test:e2e`)

**Critério de aceite**
- `npm run test:e2e` passa com os 3 casos novos de 403 `FORBIDDEN_PERMISSION`.
- `npx jest` em `backend/` com todas as suítes `PASS` (as 46 anteriores + 5 novas) e `Tests:` sem `failed`.
- `npx tsc --noEmit` e `npx eslint "{src,test}/**/*.ts"` em `backend/` com exit 0 e saída vazia.

**Validação**
- `cd backend && npm run test:e2e` (evidência: `Tests:` sem `failed` e os 3 títulos novos na saída com `--verbose`)
- `cd backend && npx jest` (evidência: `Test Suites: 51 passed`, `Tests:` sem `failed`)
- `cd backend && npx tsc --noEmit && npx eslint "{src,test}/**/*.ts"` (evidência: exit 0, nenhuma linha de saída)
- `cd backend && npm run build` (evidência: exit 0)

## Legenda

- [ ] pendente
- [~] em andamento
- [x] concluído com evidência
- [!] bloqueado
