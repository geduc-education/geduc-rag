# Eficiência — kai-20260928-1613-novidades-github

- Plano: `/home/kaine/source/geduc-rag/.claude/tasks/kai-20260928-1613-novidades-github` · projeto `/home/kaine/source/geduc-rag` · versão 2.5.1? · gerado em 2026-09-28T17:34:43-03:00 · última onda medida 6
- Sessões: 620961c4-2eeb-49ef-98ff-082b2a5126c3 (encontrada)
- Base: sem base (nenhum plano da versão anterior no acervo)

## Indicadores

| Indicador | Este plano | Base |
|---|---|---|
| Tokens retidos por onda (mediana) | 19296,50 | sem base |
| Contexto máximo | 379.361 | sem base |
| Compactações | 0 | sem base |
| Correções por implementador | 0,06 | sem base |
| Retornos acima do limite (%) | 12 | sem base |
| Validador acima da meta (%) | 0 | sem base |
| Aprovadas de primeira (%) | 100 | sem base |
| Precisão do mapa de arquivos (%) | 100 | sem base |
| Rodadas de fix loop | 0 | sem base |
| Tasks de correção pós-Fase 5 (%) | 0 | sem base |

## Tasks

| Task | Onda | Origem | Complexidade | Status | RED | Gate | Fix loop | Revisor (bloq./sug.) | Perguntas | Desvios | Fora do previsto |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T-01 | 1 | plano | simples | [x] | ok | 0 | 0 | 0/1 | 0 | 0 | — |
| T-02 | 1 | plano | média | [x] | ok | 0 | 0 | 0/0 | 0 | 0 | — |
| T-03 | 1 | plano | média | [x] | ok | 0 | 0 | 0/4 | 0 | 3 | — |
| T-04 | 2 | plano | alta | [x] | ok | 0 | 0 | 0/3 | 0 | 2 | — |
| T-05 | 3 | plano | média | [x] | inválido | 0 | 0 | 0/2 | 0 | 2 | — |
| T-06 | 2 | plano | simples | [x] | ok | 0 | 0 | 0/2 | 0 | 0 | — |
| T-07 | 3 | plano | média | [x] | ok | 0 | 0 | 0/2 | 0 | 0 | — |
| T-08 | 4 | plano | média | [x] | ok | 0 | 0 | 0/3 | 0 | 0 | — |
| T-09 | 4 | plano | simples | [x] | não declarado | 0 | 0 | 0/1 | 0 | 0 | — |
| T-10 | 6 | plano | simples | [x] | sem teste | 0 | 0 | 0/0 | 0 | 3 | — |
| T-11 | 5 | plano | média | [x] | sem teste | 0 | 0 | 0/0 | 0 | 3 | — |

## Causas

- T-03: Ajustes no spec (tipagem do mock, mockImplementation p/ Response de leitura única) e mensagens de erro fixas por reason sem corpo/mensagem original
- T-04: T-02 não exportou constante de payload não configurado (service monta local) e DTO usou import type por erro TS1272 (isolatedModules).
- T-11: Desvios leves aceitos: AnimatedBuilder só no child, layout scroll+center, error com fallback vazio — sem impacto no contrato
