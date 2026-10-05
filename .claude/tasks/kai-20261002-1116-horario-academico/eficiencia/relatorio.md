# Eficiência — kai-20261002-1116-horario-academico

- Plano: `/home/kaine/source/geduc-rag/.claude/tasks/kai-20261002-1116-horario-academico` · projeto `/home/kaine/source/geduc-rag` · versão 2.5.1? · gerado em 2026-10-02T14:31:02-03:00 · última onda medida 3
- Sessões: 6978a721-eb66-4296-a032-a3b7fa1a7227 (encontrada)
- Base: sem base (nenhum plano da versão anterior no acervo)

## Indicadores

| Indicador | Este plano | Base |
|---|---|---|
| Tokens retidos por onda (mediana) | 12208,50 | sem base |
| Contexto máximo | 308.884 | sem base |
| Compactações | 0 | sem base |
| Correções por implementador | 0,07 | sem base |
| Retornos acima do limite (%) | 11 | sem base |
| Validador acima da meta (%) | 0 | sem base |
| Aprovadas de primeira (%) | 83 | sem base |
| Precisão do mapa de arquivos (%) | n/d | sem base |
| Rodadas de fix loop | 1 | sem base |
| Tasks de correção pós-Fase 5 (%) | 0 | sem base |

## Tasks

| Task | Onda | Origem | Complexidade | Status | RED | Gate | Fix loop | Revisor (bloq./sug.) | Perguntas | Desvios | Fora do previsto |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T-01 | 1 | plano | média | [x] | sem teste | 0 | 0 | 0/0 | 0 | 0 | — |
| T-02 | 1 | plano | alta | [x] | ausente | 0 | 0 | 0/3 | 0 | 3 | — |
| T-03 | 2 | plano | média | [x] | ausente | 0 | 0 | 0/2 | 0 | 0 | — |
| T-04 | 2 | plano | média | [x] | ausente | 0 | 0 | 0/2 | 0 | 0 | — |
| T-05 | 2 | plano | alta | [x] | ausente | 0 | 0 | 0/3 | 0 | 5 | — |
| T-06 | 3 | plano | alta | [x] | ausente | 0 | 1 | 2/4 | 0 | 3 | — |

## Causas

- T-01: Interface sem ON UPDATE nas FKs; seguiu a convenção da 0004 (ON UPDATE CASCADE e FK de tenant_id nas filhas).
- T-02: addDays reimplementado (o do calendário é privado); mergeWithRecorded descarta data fora de replicated.
- T-05: TOUCH_SCHEDULES_SQL ganhou deleted_at IS NULL e saveWeeks relê os horários na transação para devolver created/replaced; contrato literal não cobria
- T-06: Revisão reprovou: spec sem prova de remoção das aulas antigas na replicação e sem discriminar precedência do calendário da escola; corrigido só no spec
