# Revisão final
Branch `task/calendario-academico` contra `main` (merge-base bfa7b34). 51 arquivos, nenhum fora do Mapa de arquivos além dos artefatos do plano.
Verificação (2026-10-01, em `backend/`): `npx tsc --noEmit` exit 0 sem saída; `npx eslint "{src,test}/**/*.ts"` exit 0 sem saída; `npx jest` → `Test Suites: 51 passed`, `Tests: 436 passed`; `npx jest src/modules/academic-calendar src/modules/schools` → 5 suítes, 59 testes passam; `npm run test:e2e` → `Tests: 21 passed` (18 + 3 novos de 403). `validator.isISO8601('2026-02-30', { strict: true })` → false (data inexistente recusada pelo DTO). `npm run db:migrate` não reexecutado (evidência de T-01/T-07 em reports).
Review Focus: os 5 itens têm caso no spec (service: domingo imutável sem gravar, escola de outro tenant/excluída, `allSchools: true` → `schoolIds: []`; repositório: `DATE_FORMAT` e `s.deleted_at IS NULL` no `EXISTS`/vínculos).
## Triagem
- [resolvida] T-01: isolamento de `academic_calendar_school`/`academic_calendar_day` depende do SQL → backend/src/modules/academic-calendar/infra/database/repositories/academic-calendar.repository.ts:46 (`s.tenant_id = ?` em `findExistingSchoolIds`), :39 (`s.tenant_id = c.tenant_id` nos vínculos), :206 (`tenantId` no INSERT dos dias), :66 (DELETE de vínculos com join no tenant)
- [resolvida] T-01: `description TEXT` sem limite → backend/src/modules/academic-calendar/dto/academic-calendar.dto.ts:167 (`@MaxLength(1000)`)
- [resolvida] T-02: `assertCalendarRange` não recusa data inexistente → backend/src/modules/academic-calendar/dto/academic-calendar.dto.ts:39 (`@IsDateString({ strict: true })` + regex; `2026-02-30` recusado)
- [resolvida] T-03: `update` de escola inexistente virava 500 → backend/src/modules/schools/schools.service.ts:76
- [aberta] T-03: spec de `list` não cobre filtro `active: false` → backend/src/modules/schools/__tests__/school.repository.spec.ts:68
- [aberta] T-03: `makeConnection` duplicado (agora também em academic-calendar.repository.spec.ts) → candidato a helper compartilhado
- [resolvida] T-04: `updateDay` em calendário excluído virava 500 → backend/src/modules/academic-calendar/academic-calendar.service.ts:176
- [resolvida] T-04: `allSchools: true` precisa mandar `schoolIds: []` → backend/src/modules/academic-calendar/academic-calendar.service.ts:231 e spec :221
- [aberta] T-05: nome só com espaços passa no DTO e grava vazio → backend/src/modules/schools/dto/school.dto.ts:21 (`@MinLength(2)` antes do `trim()` de schools.service.ts:58)
- [aberta] T-05: `withNameConflict` relança erro cru (500) quando a rechecagem não acha dono; ramo sem teste → backend/src/modules/schools/schools.service.ts:138-141
- [aberta] T-05: rotas sem Swagger de 404/409 → backend/src/modules/schools/schools.controller.ts:53-84
- [aberta] T-06: `update` com `schoolIds` inexistentes/de outro tenant sem caso no spec → backend/src/modules/academic-calendar/__tests__/academic-calendar.service.spec.ts:220-272
- [aberta] T-06: 404 `CALENDAR_NOT_FOUND` de `remove` e `listDays` sem caso no spec → backend/src/modules/academic-calendar/__tests__/academic-calendar.service.spec.ts:274-306
- [aberta] T-06: `name` valida `@MinLength(2)` antes do `trim()` → backend/src/modules/academic-calendar/dto/academic-calendar.dto.ts:62,96 e academic-calendar.service.ts:114,137
- [aberta] T-07: e2e de 403 cobre 3 das 12 rotas novas (as demais têm `@RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)`: 5 em schools, 7 no calendário) → backend/test/app.e2e-spec.ts:310-334
## Rulings
- plano · onda — — Permissão única `employee:manage` em todas as rotas de `/schools` e `/academic-calendars`, leitura inclusive; sem permissão nova.
- plano · onda — — Escola e calendário em módulos separados; calendário valida `schoolIds` por SQL próprio (`findExistingSchoolIds`).
- plano · onda — — Dias materializados em `academic_calendar_day`, inserção em lote `VALUES ?`; quantitativos por `GROUP BY` ou contagem da visão.
- plano · onda — — Colunas `school_year`, `day_date`, `day_type`; datas lidas com `DATE_FORMAT(..., '%Y-%m-%d')`.
- plano · onda — — Semana domingo–sábado; intervalo dentro do `year`; `year`/datas imutáveis; domingo aceita só `NON_SCHOOL_DAY` (no-op); descrição vazia vira `null`.
- plano · onda — — Nome de escola único por tenant inclusive entre excluídas; escola excluída some de `schoolIds`, vínculo permanece.
- T-01 · onda 1 — `deleted_by_id` sem FK em `school`/`academic_calendar`; em `academic_calendar_day` só `updated_by_id` com FK.
- T-02 · onda 1 — `assertCalendarRange` só confere prefixo do ano e ordem; datas inexistentes recusadas no DTO de T-06.
- T-04 · onda 2 — Queries de dia fazem join com `academic_calendar` (`c.deleted_at IS NULL`, `c.tenant_id = d.tenant_id`).
- T-04 · onda 2 — `findExistingSchoolIds` ignora `active`; `update` só mexe nos vínculos com `schoolIds` definido; `updated_at` dos dias em lote vai como `Date` do processo (adapter com `timezone: 'Z'`).
## Achados
- [sugestão] Nome de escola e de calendário só com espaços (ex.: `"   "`) passa no DTO e é gravado como `""`; um `@Transform` de `trim()` antes do `@MinLength(2)` fecharia os dois → backend/src/modules/schools/dto/school.dto.ts:21, backend/src/modules/academic-calendar/dto/academic-calendar.dto.ts:62
- [sugestão] `update`/`updateDay` do repositório lançam `Error` genérico (500) se o calendário for excluído entre o `findOrFail` do service e a gravação (corrida rara) → backend/src/modules/academic-calendar/infra/database/repositories/academic-calendar.repository.ts:341,402
