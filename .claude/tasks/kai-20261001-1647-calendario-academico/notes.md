# Notas de execução

## Decisões tomadas
- 2026-10-01 · plano · onda — · Permissão única `employee:manage` (`PERMISSIONS.EMPLOYEE_MANAGE`, a de `POST /employees`) em todas as rotas de `/academic-calendars` e `/schools`, leitura inclusive: o usuário pediu "quem acessa o dia = quem cria funcionários" e não há chave de escola no catálogo; criar `school:*`/`calendar:*` exigiria seed, perfis default e espelho no frontend (fora do escopo).
- 2026-10-01 · plano · onda — · Escola e calendário em módulos separados; o calendário valida `schoolIds` por SQL no próprio repositório (`findExistingSchoolIds`) para não importar `SchoolsModule`.
- 2026-10-01 · plano · onda — · Dias materializados (uma linha por dia em `academic_calendar_day`, inserção em lote com `VALUES ?`); quantitativos por `GROUP BY` (calendário inteiro) ou contagem dos dias da visão (dia/semana/mês/ano).
- 2026-10-01 · plano · onda — · Colunas `school_year` e `day_date`/`day_type` em vez de `year`/`date`/`type` (palavras-chave do MySQL); datas lidas com `DATE_FORMAT(..., '%Y-%m-%d')` porque o adapter usa `dateStrings: false` e sessão UTC.
- 2026-10-01 · plano · onda — · Semana = domingo a sábado; intervalo do calendário dentro do `year` informado; `year`/datas imutáveis após criar; domingo aceita `type: 'NON_SCHOOL_DAY'` como no-op e rejeita qualquer outro tipo; descrição vazia vira `null`.
- 2026-10-01 · plano · onda — · Nome de escola único por tenant inclusive entre excluídas (mesmo critério de e-mail/CPF de `employee`); escola excluída some de `schoolIds`, mas o vínculo permanece na tabela.

- 2026-10-01 · T-01 · onda 1 — `deleted_by_id` sem FK em `school`/`academic_calendar` (como em `0003_employee.sql`); em `academic_calendar_day` só `updated_by_id` com FK para `user`.
- 2026-10-01 · T-02 · onda 1 — `assertCalendarRange` só confere prefixo do ano e ordem; datas inexistentes são recusadas no DTO de T-06, não nas regras.
- 2026-10-01 · T-04 · onda 2 — Queries de dia fazem join com `academic_calendar` (`c.deleted_at IS NULL`, `c.tenant_id = d.tenant_id`): calendário excluído não expõe dias.
- 2026-10-01 · T-04 · onda 2 — `findExistingSchoolIds` ignora `active` (só tenant e `deleted_at IS NULL`); `update` só mexe nos vínculos quando `schoolIds` é definido; `updated_at` dos dias em lote vai como `Date` do processo.

## Bloqueios
- nenhum

## Descobertas
- Baseline em `backend/` (2026-10-01): `npx tsc --noEmit` e `npx eslint "{src,test}/**/*.ts"` com 0 linhas; `npx jest` 46 suítes / 377 testes; `npm run test:e2e` 18 testes.
- A árvore tinha alterações não commitadas fora do escopo em `frontend/lib/core/errors/app_exception.dart`, `frontend/lib/core/http/api_client.dart` e `frontend/lib/modules/rag_assistant/data/rag_chat_repository.dart`: nenhum agente deste plano as toca nem as commita.
- Alterações não commitadas do usuário no frontend (`app_exception.dart`, `api_client.dart`, `rag_chat_repository.dart`) foram guardadas com `git stash` antes de abrir a branch: stash@{0} "wip-frontend-antes-calendario-academico" (em main). Não tocar no stash; restaurar só a pedido do usuário.
- Onda 1: T-01 e T-02 aprovadas no gate e na revisão rodada 1 (aprovado com sugestões, sem bloqueantes).
- [T-04] `update` do repositório só substitui vínculos quando `schoolIds` é definido; ao virar `allSchools: true`, o service (T-06) deve mandar `schoolIds: []`. Dias de calendário excluído não são lidos (join com `c.deleted_at IS NULL`).
- Onda 2: T-03 e T-04 aprovadas no gate e na revisão rodada 1 (aprovado com sugestões, sem bloqueantes).
- [T-06] `PATCH /academic-calendars/:id/days/:date` valida params via `CalendarDayParamsDto`; `GET /:id/days` e `PATCH /:id/days/:date` respondem 404 `CALENDAR_NOT_FOUND` antes de ler dias. `AcademicCalendarModule` e `SchoolsModule` prontos, não registrados (T-07).
- Onda 3: T-05 e T-06 aprovadas no gate e na revisão rodada 1 (aprovado com sugestões, sem bloqueantes).
- Onda 4: T-07 aprovada no gate e na revisão rodada 1 (aprovado, sem bloqueantes); `npm run db:migrate` em localhost:3307 → "applied: (nenhuma)" (0004 já aplicada na onda 1).

## Pendências
- T-01: `academic_calendar_school` sem `tenant_id` e `academic_calendar_day.tenant_id` sem amarração ao tenant do calendário: isolamento depende do SQL de T-04/T-06 (`findExistingSchoolIds` com `tenant_id = ?`, `tenant_id` no INSERT dos dias).
- T-01: `description TEXT NULL` sem limite no schema: DTO de T-06 precisa de `@MaxLength`.
- T-02: `assertCalendarRange` não recusa data inexistente (`2026-02-30` rola para março em `buildCalendarDays`): DTO de T-06 precisa de `@IsDateString`/regex estrito que recuse datas inexistentes.
- T-03: `update` de escola inexistente/excluída lançava `Error` genérico (500): resolvida em T-05 (`update` e `remove` chamam `findById` antes; 404 `SCHOOL_NOT_FOUND` coberto no spec).
- T-03: spec de `list` não cobre o filtro `active` (`active: false`).
- T-03: `makeConnection` duplicado de `employee.repository.spec.ts`; candidato a helper compartilhado.
- T-04: `updateDay` em calendário excluído virava `Error` genérico (500): resolvida em T-06 (`updateDay` e `listDays` checam `findById` antes; 404 `CALENDAR_NOT_FOUND`).
- T-04 (para T-06): `allSchools: true` manda `schoolIds: []`: resolvida em T-06 (caso do Review Focus presente no spec e revisado).
- T-05: nome só com espaços passa no DTO (`@MinLength(2)` roda antes do `trim()` do service) e grava vazio; `" a "` vira `"a"`.
- T-05: `withNameConflict` relança erro cru do MySQL (500) quando a checagem refeita não acha outro dono; ramo sem teste.
- T-05: rotas sem Swagger de 404 `SCHOOL_NOT_FOUND` e 409 `SCHOOL_NAME_TAKEN` (igual a `employees.controller.ts`).
- T-06: `update` com `schoolIds` inexistentes/de outro tenant sem caso no spec (só create coberto).
- T-06: 404 `CALENDAR_NOT_FOUND` de `remove` e `listDays` sem caso no spec.
- T-06: `name` valida `@MinLength(2)` antes do `trim()` do service: `"  a  "` passa e grava `"a"`.
- T-07: e2e de 403 cobrem só GET /schools, GET /academic-calendars e PATCH /academic-calendars/:id/days/:date, não todas as rotas individualmente (informativa).

## Riscos
- MySQL local fora do ar ou credencial diferente de `rag`/`rag` em `127.0.0.1:3307` impede a validação de T-01 → o agente relata em Pendências sem ler `backend/.env`; T-03/T-04 seguem (specs usam conexão falsa).
- Hook `protect-migrations.sh` pede confirmação ao criar `backend/database/migrations/0004_academic_calendar.sql` → esperado; o agente não contorna.
- Hook `format-file.sh` aplica `eslint --fix` no arquivo editado → o agente relê o arquivo antes de commitar; `npm run lint`/`npm run format` continuam proibidos.
- Calendários sobrepostos para a mesma escola/ano não são barrados (não pedido) → registrado como fora de escopo.

## Retomada
- Pasta: `.claude/tasks/kai-20261001-1647-calendario-academico/`
- Sessões: 6978a721-eb66-4296-a032-a3b7fa1a7227
- Branch de trabalho: task/calendario-academico (base: main)
- BASE da onda 1: bfa7b34
- Commits por onda:
  - Onda 1: BASE bfa7b34 → HEAD 2714f91 (8b11e7f, bf6a1b4, 2714f91)
  - Onda 2: BASE 4451870 → HEAD 22b9c0b (7a7df3a, b9ebca2, b958790, 22b9c0b)
  - Onda 3: BASE 194629e → HEAD 374c700 (821f513, 2e400d8, fe78aec, 374c700)
  - Onda 4: BASE 006ff4b → HEAD 1d07cf7 (bc15a90, 1d07cf7)
- Último status conhecido: onda 4 concluída (T-07 [x]); plano completo
- Próxima onda recomendada: nenhuma (revisão final)
