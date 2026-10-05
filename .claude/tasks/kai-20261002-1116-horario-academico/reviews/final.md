# Revisão final
Branch `task/horario-de-aula` contra `main` (BASE `206bc5d`), execução sem commits: `git log --oneline -1` = `206bc5d`; `git diff 206bc5d` (app.module.ts, error-codes.ts, app.e2e-spec.ts) + não rastreados (0005_weekly_schedule.sql, modules/subjects, modules/school-classes, modules/weekly-schedules), todos no Mapa de arquivos. Verificação read-only: `npx tsc --noEmit` exit 0; `npx eslint "{src,test}/**/*.ts"` exit 0 sem saída; `npx jest --reporters=default` → 58 suítes / 519 testes PASS (as 7 novas listadas); `npm run test:e2e` → 26/26; `npx prettier --check` nos arquivos da branch → limpo. Nada de Excluído implementado (sem frontend, sem permissão nova, sem seed). Itens da Review Focus com teste: T-02 (rules.spec "2026-12-19"), T-05 (repository.spec OUTDATED/TIME_FORMAT), T-06 (service.spec (a) e (e)).
## Triagem
- [aberta] T-02: `mergeWithRecorded` descarta em silêncio registrada fora de `replicated` → weekly-schedule.rules.ts:320-328; inalcançável pelo service (alvo sempre com os 7 dias da mesma semana), não agravada
- [resolvida] T-02: `addDays`/`listPeriodDates` com data malformada → RangeError → weekly-schedule.dto.ts:29-63,82,103-108,140,166-172 (`IsCalendarDate` estrito e `TIME_PATTERN` com zero à esquerda em toda entrada de data/hora)
- [aberta] T-02: caso do sábado letivo filtra o domingo sem necessidade → weekly-schedule.rules.spec.ts:239
- [aberta] T-03: spec de `list` não cobre o filtro `active` → subject.repository.spec.ts:68
- [aberta] T-03: `ListSubjectsDto.active` converte valor inválido em `false` → subject.dto.ts:45
- [aberta] T-04: nome só com espaços vira `''` após `trim()` → school-class.dto.ts:45,60; school-classes.service.ts:74,100 (o mesmo vale para disciplinas, ver Achados)
- [aberta] T-04: respostas de erro fora do Swagger → school-classes.controller.ts:53-97
- [aberta] T-05: `DELETE_DAYS_SQL` sem `deleted_at IS NULL`; replace de horário excluído concorrentemente só falha em `pickInOrder` (500 com rollback, sem perda) → weekly-schedule.repository.ts:106-112,318-329,429-436
- [aberta] T-05: spec de `updateLessonRecord` não afirma `l.content_recorded = ?` nem a ordem dos params → weekly-schedule.repository.spec.ts:357-370
- [aberta] T-05: spec de `saveWeeks` não afirma params; `findClass`, `findExistingSubjectIds` não vazia e `softDelete` sem caso → weekly-schedule.repository.spec.ts:290-355
- [aberta] T-06: nenhum teste afirma que `findCalendarCandidates` recebe a escola da turma (`'s1'`) → weekly-schedules.service.spec.ts:132-136,163-166
- [aberta] T-06: aula registrada com disciplina excluída ou em dia que deixou de ser letivo trava PUT (400/409) e DELETE (409); consequência das regras do plano, decisão do orquestrador → weekly-schedules.service.ts:309-315,325-334
- [aberta] T-06: Swagger sem respostas de erro (404 SCHEDULE_NOT_FOUND/SCHOOL_CLASS_NOT_FOUND, 400 SCHEDULE_*) em POST, PUT, replicate e GET list → weekly-schedules.controller.ts:79-127 (as linhas 612-660 citadas na pendência não existem; o arquivo tem 148 linhas)
- [aberta] T-06: `remove` checa registros e chama `softDelete` sem trava (corrida com PATCH .../record) → weekly-schedules.service.ts:325-334
- [resolvida] T-07: `app.module.ts` editado por script sem o hook de formatação → `npx prettier --check src/app.module.ts` limpo e eslint exit 0
## Rulings
- plano · onda — — Permissão única `employee:manage` em todas as rotas de `/subjects`, `/school-classes` e `/weekly-schedules`, leitura inclusive.
- plano · onda — — Registro de conteúdo e frequência por aula (`content_recorded`, `attendance_recorded`); resumo `record` por contagens.
- plano · onda — — Calendário aplicável por data (`findCalendarCandidates` + `resolveCalendarDays`): escola prevalece sobre o geral; empate → menor `calendarId`.
- plano · onda — — Aula em dia não `SCHOOL_DAY`: rejeitada na criação/edição (400), descartada na replicação.
- plano · onda — — Sábado `SCHOOL_DAY` sem aula bloqueia criação, edição e replicação (400 `SCHEDULE_SATURDAY_WITHOUT_LESSONS`).
- plano · onda — — Situação `UP_TO_DATE`/`OUTDATED` na leitura comparando o instantâneo do dia com o calendário atual; calendário excluído → `OUTDATED`.
- plano · onda — — (usuário) Semana sempre segunda a domingo, tocando o `schoolYear`; uma semana por turma (409); semana imutável no PUT.
- plano · onda — — Data sem calendário fica `null` (sem aula); 400 `SCHEDULE_CALENDAR_NOT_FOUND` só com a semana inteira sem calendário.
- plano · onda — — (usuário) Replicação por semana com sobrescrita preservando registradas, `discarded` com `RECORDED_CONFLICT`/`NON_SCHOOL_DAY`, tudo ou nada em `saveWeeks`.
- plano · onda — — (usuário) Registro por aula; aula registrada não pode ser alterada/excluída (409); situação; aula em dia não letivo rejeitada/descartada.
- plano · onda — — (usuário) Trabalho direto em `task/horario-de-aula`, base `main` (`206bc5d`).
- plano · onda — — (usuário) Execução sem commits; TDD pela evidência em `reports/T-XX.md § RED`; escopo pelo working tree.
- plano · onda — — PUT substitui os dias; aula idêntica herda as flags; remover/alterar registrada ou excluir horário com registrada → 409.
- plano · onda — — O horário lê turma, disciplinas e calendário por SQL próprio, sem importar outros módulos Nest.
- plano · onda — — Turma com `schoolYear` e nome único por `(tenant, escola, ano)`, escola/ano imutáveis; disciplina espelho de escolas.
- T-00 · onda 1 — (orquestrador) Comentário da linha "Branch de trabalho" movido para "Observação" em plan.md, sem mudança de conteúdo.
- T-00 · onda 1 — (usuário) Executar só a onda 1 por ora; ondas 2–4 aguardaram nova ordem.
- T-04/T-05 · onda 2 — (orquestrador) Bloqueio do hook Stop por eslint nos specs RED aceito como ruído transitório; sem ação de código.
- T-06 · onda 3 — (orquestrador) Onda de escritor único em primeiro plano para evitar bloqueios do hook Stop durante o RED.
- T-06 · onda 3 — (orquestrador) Evidência de jest com `--reporters=default` aceita.
- T-07 · onda 4 — (orquestrador) `app.module.ts` editado por script sem hook de formatação, aceito com eslint limpo.
## Achados
- [sugestão] Nome de disciplina só com espaços (`"  "`) passa em `@MinLength(2)` e é gravado como `''` após `trim()`; mesmo defeito da pendência de turmas → subject.dto.ts:20-23; subjects.service.ts:58,77
- [sugestão] `/subjects` sem respostas de erro no Swagger (404 `SUBJECT_NOT_FOUND`, 409 `SUBJECT_NAME_TAKEN`), como em turmas e horário → subjects.controller.ts:61-104
- [sugestão] `ListWeeklySchedulesDto` não recusa `from > to` (lista vazia em vez de 400) → weekly-schedule.dto.ts:164-172
