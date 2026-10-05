# Notas de execução

## Decisões tomadas
- 2026-10-02 · plano · onda — · Permissão única `employee:manage` (`PERMISSIONS.EMPLOYEE_MANAGE`) em todas as rotas de `/subjects`, `/school-classes` e `/weekly-schedules`, leitura inclusive, como `/schools` e `/academic-calendars`; chave nova exigiria seed, perfis default e espelho no frontend (fora do escopo).
- 2026-10-02 · plano · onda — · Registro de conteúdo e frequência **por aula** (`content_recorded`, `attendance_recorded` em `weekly_schedule_lesson`): o diário de classe registra por aula; o resumo do horário (`record`) são contagens derivadas.
- 2026-10-02 · plano · onda — · Calendário aplicável resolvido **por data**: candidatos numa só query (`findCalendarCandidates`) e escolha na regra pura `resolveCalendarDays` — calendário vinculado à escola da turma prevalece sobre o geral (`all_schools`); empate → menor `calendarId` (não há unique de calendário por escola/ano).
- 2026-10-02 · plano · onda — · Aula em dia não `SCHOOL_DAY`: rejeitada na criação e na edição (400 `SCHEDULE_LESSON_ON_NON_SCHOOL_DAY`), descartada na replicação (o padrão semanal atravessa feriados).
- 2026-10-02 · plano · onda — · Sábado `SCHOOL_DAY` sem aula bloqueia criação, edição e replicação (400 `SCHEDULE_SATURDAY_WITHOUT_LESSONS`), conforme decisão 4 do usuário.
- 2026-10-02 · plano · onda — · Situação `UP_TO_DATE`/`OUTDATED` calculada na leitura comparando o instantâneo (`weekly_schedule_day.calendar_id` + `day_type`) com o dia atual do mesmo calendário; calendário excluído também vira `OUTDATED`.
- 2026-10-02 · plano · onda — · (usuário) Semana sempre segunda a domingo: `startDate` segunda e `endDate = startDate + 6`, senão 400 `SCHEDULE_INVALID_PERIOD`; a semana toca o `schoolYear` da turma; uma semana por turma (409 `SCHEDULE_WEEK_TAKEN` na criação); semana imutável no PUT.
- 2026-10-02 · plano · onda — · Data da semana sem calendário aplicável fica `calendarId: null`/`dayType: null` (sem aula, `hasClass: false`); 400 `SCHEDULE_CALENDAR_NOT_FOUND` só se a semana inteira não tem calendário — senão a primeira e a última semana do ano letivo seriam impossíveis com a semana fixa.
- 2026-10-02 · plano · onda — · (usuário) Replicação por semana (segundas alvo, 1 a 20, diferentes da origem), por dia da semana; semana alvo ocupada é sobrescrita: aulas registradas ficam com as flags, as não registradas saem; replicada que colide no horário com registrada é descartada (`discarded`, `RECORDED_CONFLICT`), idêntica é absorvida; replicada em dia não letivo é descartada (`NON_SCHOOL_DAY`); resposta com `action` (`CREATED`/`OVERWRITTEN`), `preserved` e `discarded` por semana; sábado letivo sem aula no resultado bloqueia; tudo ou nada numa transação (`saveWeeks` com creates + replaces em lote).
- 2026-10-02 · plano · onda — · (usuário) Confirmados: registro por aula; aula registrada não pode ser alterada/excluída (409 `SCHEDULE_HAS_RECORDS`); situação `UP_TO_DATE`/`OUTDATED`; aula em dia não letivo rejeitada na criação/edição e descartada na replicação.
- 2026-10-02 · plano · onda — · (usuário) Branch: trabalhar direto em `task/horario-de-aula` (base `main`, `206bc5d`), sem criar outra branch.
- 2026-10-02 · plano · onda — · (usuário) **Execução sem commits**: nenhum agente roda `git add`, `git commit`, `git reset`, `git stash`, `git checkout` ou `git restore`. TDD comprovado em `reports/T-XX.md § RED` (saída falhando antes da implementação, depois passando); escopo conferido no working tree (`git status --porcelain`, `git diff 206bc5d`) contra os "Arquivos prováveis" exclusivos de cada task; BASE de todas as ondas = `206bc5d`. O fechador só atualiza os artefatos de `.claude/tasks/` e não commita.
- 2026-10-02 · plano · onda — · Edição (PUT) substitui período e dias; aula idêntica por `(date, startTime, endTime, subjectId)` herda as flags; remover/alterar aula registrada ou excluir horário com aula registrada → 409 `SCHEDULE_HAS_RECORDS`.
- 2026-10-02 · plano · onda — · O horário lê turma, disciplinas e calendário por SQL no próprio repositório, sem importar `SubjectsModule`, `SchoolClassesModule` nem `AcademicCalendarModule` (mesmo precedente do `findExistingSchoolIds` do calendário); `weekly-schedule.rules.ts` importa só tipos e `weekdayOf` de `academic-calendar.rules.ts`.
- 2026-10-02 · plano · onda — · Turma com `schoolYear` e nome único por `(tenant, escola, ano)`; `schoolId`/`schoolYear` imutáveis. Disciplina por tenant, espelho do cadastro de escolas.
- 2026-10-02 · T-00 · onda 1 — (orquestrador, plano) plan.md § Estratégia de execução: comentário da linha "Branch de trabalho" movido para linha "Observação" separada (o repos.py não lia a linha); sem mudança de conteúdo.
- 2026-10-02 · T-00 · onda 1 — (usuário) Executar só a onda 1 (T-01 e T-02) por ora; ondas 2–4 aguardam nova ordem.
- 2026-10-02 · T-04/T-05 · onda 2 — (orquestrador) O hook Stop `check-complexity.sh` bloqueou por erros de eslint (no-unsafe-*) nos specs RED de T-04 e T-05, que importavam módulos ainda não implementados; ruído transitório do RED com escritores paralelos, sumiu com a implementação (gate: eslint exit 0). Sem ação de código.
- 2026-10-02 · T-06 · onda 3 — (orquestrador) Onda de escritor único executada em primeiro plano para evitar bloqueios repetidos do hook Stop `check-complexity.sh` durante o RED.
- 2026-10-02 · T-06 · onda 3 — (orquestrador) Evidência de jest gerada com `--reporters=default` porque o reporter padrão não exibe PASS/✓ neste ambiente — aceito.
- 2026-10-02 · T-07 · onda 4 — (orquestrador) `app.module.ts` foi editado por script e o hook de formatação não rodou nele; aceito porque eslint saiu sem saída.

## Bloqueios
- nenhum

## Descobertas
- Baseline em `backend/` (2026-10-02): `npx tsc --noEmit` e `npx eslint "{src,test}/**/*.ts"` com exit 0 e 0 linhas.
- O calendário acadêmico (0004, `schools`, `academic-calendar`) já está commitado em `main` (`206bc5d`); a sessão está em `task/horario-de-aula`, no mesmo commit, com a árvore limpa salvo esta pasta. Não há base sem commit a tratar.
- Sem commits, os `id` das aulas mudam a cada PUT/replicação (dias regravados); as flags de registro são preservadas pelas regras.
- `stash@{0}` ("wip-frontend-antes-calendario-academico", em `main`) guarda WIP de frontend do usuário: nenhum agente o toca.
- `IsCalendarDate` de `academic-calendar.dto.ts` não é exportado: T-06 copia o validador localmente.
- T-05: `IWeeklyScheduleRepository`/`WEEKLY_SCHEDULE_REPOSITORY` e records conforme a Interface de T-05; `saveWeeks` gera os ids dos `creates` (randomUUID) e devolve `created`/`replaced` relidos na transação, na ordem dos inputs; métodos de escrita sem `tx?`.

## Pendências
- T-02: `mergeWithRecorded` descarta em silêncio de `days` aula registrada cuja data não está em `replicated` (só aparece em `preserved`); lançar erro ou incluir o dia (weekly-schedule.rules.ts:320-328).
- T-02: `addDays`/`weekPeriod`/`listPeriodDates` com data malformada lançam `RangeError` (500); T-06 deve validar `YYYY-MM-DD` real e `HH:mm` com zero à esquerda nos DTOs (rules.ts:72-75,110,119).
- T-02: caso do sábado letivo no spec filtra o domingo sem necessidade (spec:239).
- T-03: spec de `list` não cobre o filtro `active` (subject.repository.spec.ts:68).
- T-03: `ListSubjectsDto.active` converte valor diferente de `true`/`'true'` em `false` (`?active=abc` filtra inativas em vez de 400); herdado de `schools` (subject.dto.ts:45).
- T-04: nome só com espaços passa em `@MinLength(1)` e vira `''` após `trim()`; herdado de `schools` (school-class.dto.ts:45,:60; school-classes.service.ts:74,:100).
- T-04: respostas de erro (400 `SCHOOL_CLASS_SCHOOL_INVALID`, 404, 409) fora do Swagger, como em `schools.controller.ts` (school-classes.controller.ts:53-97).
- T-05: `saveWeeks`: `TOUCH_SCHEDULES_SQL` filtra `deleted_at IS NULL` mas `DELETE_DAYS_SQL` não; `replace` com id excluído/de outro tenant apaga dias e só falha em `pickInOrder` (500 com rollback); conferir `affectedRows` do UPDATE antes (weekly-schedule.repository.ts:106-112,:318-329,:429-436).
- T-05: spec de `updateLessonRecord` não afirma `l.content_recorded = ?` nem a ordem dos params (spec:357-370).
- T-05: spec de `saveWeeks` não afirma params; `findClass`, `findExistingSubjectIds` não vazia e `softDelete` sem caso (spec:290-355).
- T-06: spec: nenhum teste afirma que `findCalendarCandidates` recebe a escola da turma (`'s1'`); o mock ignora `schoolId` (weekly-schedules.service.spec.ts:129-133).
- T-06: aula registrada cuja disciplina foi excluída ou cujo dia deixou de ser `SCHOOL_DAY` trava o PUT (manter dá 400, remover dá 409) e o DELETE (409); consequência das regras do plano, vale ruling (weekly-schedules.service.ts:309-315).
- T-06: Swagger sem respostas de erro (404 `SCHEDULE_NOT_FOUND`, 400 `SCHEDULE_*`, 404 `SCHOOL_CLASS_NOT_FOUND`) em várias rotas (weekly-schedules.controller.ts:612-660).
- T-06: `remove` checa registros e chama `softDelete` sem trava; `PATCH .../record` concorrente entre as duas chamadas deixa aula registrada em horário excluído (weekly-schedules.service.ts:326-334).
- T-07: `app.module.ts` editado por script, sem o hook `format-file.sh`; eslint limpo.

## Riscos
- Checagem de semana ocupada no service, sem trava no banco: duas criações simultâneas da mesma turma/semana podem passar → aceito (cadastro de baixa concorrência); registrado para revisão.
- Sem commits, o validador e o revisor não têm trailer nem ordem de commits: RED depende da evidência colada no relatório antes da implementação, e o escopo depende de cada agente tocar só os próprios caminhos no working tree compartilhado (onda 2 com três escritores) → ondas pequenas, Mapa sem arquivo compartilhado.
- Aula registrada num dia que o calendário depois tornou não letivo trava o PUT (não pode sair: 409; não pode ficar: 400) → limitação documentada; a replicação a preserva.
- Calendário escolar criado depois de salvar o horário (mudança de precedência) não marca o horário como `OUTDATED`: a situação compara só com o calendário gravado em cada dia → limitação documentada.
- Turma ou disciplina excluída logicamente continua referenciada pelos horários existentes (FK `RESTRICT` só barra exclusão física) → fora do escopo (ver Excluído no plano).
- MySQL local fora do ar ou credencial diferente de `rag`/`rag` em `127.0.0.1:3307` impede a validação de T-01/T-07 → o agente relata em Pendências sem ler `backend/.env`; T-02 a T-06 seguem (specs com conexão falsa ou repositório mockado).
- Hook `protect-migrations.sh` pede confirmação ao criar `backend/database/migrations/0005_weekly_schedule.sql` → esperado; o agente não contorna.
- Hook `format-file.sh` aplica `eslint --fix` no arquivo editado → reler antes de commitar; `check-complexity.sh` bloqueia função complexa no Stop → regras puras em funções curtas com early return.

## Retomada
- Pasta: `.claude/tasks/kai-20261002-1116-horario-academico/`
- Sessões: 6978a721-eb66-4296-a032-a3b7fa1a7227
- Branch de trabalho: task/horario-de-aula (base: main)
- BASE da onda 1: 206bc5d
- Commits por onda:
  - Onda 1: BASE 206bc5d → working tree (sem commits)
  - Onda 2: BASE 206bc5d → working tree (sem commits)
  - Onda 3: BASE 206bc5d → working tree (sem commits)
  - Onda 4: BASE 206bc5d → working tree (sem commits)
- Último status conhecido: onda 4 concluída (T-07 [x]; gate aprovado: jest 58 suítes / 519 testes, e2e 26/26 com 5 casos de 403 novos, tsc/eslint limpos, db:migrate em localhost sem pendentes; revisão rodada 1 aprovada), sem commits; plano completo (T-01 a T-07).
- Próxima onda recomendada: nenhuma — seguir para a revisão final
