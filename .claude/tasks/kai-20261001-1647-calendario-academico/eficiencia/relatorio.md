# Eficiência — kai-20261001-1647-calendario-academico

- Plano: `/home/kaine/source/geduc-rag/.claude/tasks/kai-20261001-1647-calendario-academico` · projeto `/home/kaine/source/geduc-rag` · versão 2.5.1? · gerado em 2026-10-01T17:46:16-03:00 · última onda medida 4
- Sessões: 6978a721-eb66-4296-a032-a3b7fa1a7227 (encontrada)
- Base: sem base (nenhum plano da versão anterior no acervo)
- Ondas fechadas sem registro: 1 (rode com `--retroativo`)

## Indicadores

| Indicador | Este plano | Base |
|---|---|---|
| Tokens retidos por onda (mediana) | 12.147 | sem base |
| Contexto máximo | 102.039 | sem base |
| Compactações | 0 | sem base |
| Correções por implementador | 0 | sem base |
| Retornos acima do limite (%) | 11 | sem base |
| Validador acima da meta (%) | 0 | sem base |
| Aprovadas de primeira (%) | 100 | sem base |
| Precisão do mapa de arquivos (%) | 100 | sem base |
| Rodadas de fix loop | 0 | sem base |
| Tasks de correção pós-Fase 5 (%) | 0 | sem base |

## Tasks

| Task | Onda | Origem | Complexidade | Status | RED | Gate | Fix loop | Revisor (bloq./sug.) | Perguntas | Desvios | Fora do previsto |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T-03 | 2 | plano | simples | [x] | ok | 0 | 0 | 0/3 | 0 | 3 | — |
| T-04 | 2 | plano | alta | [ ] | ok | 0 | 0 | 0/2 | 0 | 4 | — |
| T-05 | 3 | plano | média | [x] | ok | 0 | 0 | 0/3 | 0 | 0 | — |
| T-06 | 3 | plano | alta | [x] | ok | 0 | 0 | 0/3 | 0 | 4 | — |
| T-07 | 4 | plano | simples | [x] | ok | 0 | 0 | 0/0 | 0 | 1 | — |

## Causas

- T-03: makeConnection copiado no spec e regex no lugar de grep literal; sem retrabalho
- T-04: calendário excluído não expõe dias; update só mexe em vínculos se schoolIds definido
- T-06: Plano estendido: CalendarDayParamsDto por forbidNonWhitelisted e findById antes de updateDay/listDays para 404 em vez de 500
- T-07: Ambiente sem títulos no --verbose do jest; títulos comprovados com --json.
