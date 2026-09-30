# query-builder

Helpers mínimos para montar SQL parametrizado para o `mysql2` (portados do
api-geduc-tenant, sem execução). Quem executa é o repositório, pela porta de
conexão; o builder só devolve `{ sql, params }`.

## Arquivos

- `sql-params.ts` — `CompiledQuery`, `InvalidQueryError` e `toPositional(sql, named)`:
  troca `:nome` por `?` na ordem de ocorrência (nome repetido repete o valor) e
  lança `InvalidQueryError` se faltar valor.
- `filters.ts` — `FilterContext` (`where[]` unido por `AND` + `params` nomeados):
  - `addEq(ctx, coluna, nome, valor)` — ignora `undefined`/`null`, mantém `0`/`false`;
  - `addIn(ctx, coluna, nome, valores)` — `undefined` ignora; `[]` vira `1 = 0`;
  - `addLike(ctx, colunas, nome, termo)` — `trim`, vazio ignora; `%termo%` com
    `\`, `%` e `_` escapados (equivale ao `contains` do Prisma);
  - `addRaw(ctx, fragmento, params?)` — só fragmento fixo escrito no código.
- `paged-select.ts` — `buildPagedSelect(...)` devolve `{ page, count }`: `orderBy`
  validado contra `allowedOrderBy`, `page >= 1`, `1 <= limit <= maxLimit` (100),
  `LIMIT ? OFFSET ?` como params numéricos. O repositório executa as duas e
  monta `{ data, total }`.

## Exemplo

```ts
const ctx = createFilterContext();
addRaw(ctx, 'u.deleted_at IS NULL');
addIn(ctx, 'ut.tenant_id', 'tenantIds', scope === 'all' ? undefined : scope);
addLike(ctx, ['u.name', 'u.email'], 'q', filter.search);

const { page, count } = buildPagedSelect({
  select: 'u.id, u.name, u.email',
  from: 'users u',
  ctx,
  orderBy: 'u.name ASC, u.id ASC',
  allowedOrderBy: ['u.name ASC, u.id ASC'],
  page: { page: filter.page, limit: filter.limit },
});
```

## Regras

- Valor de usuário vai sempre em `params`, nunca interpolado. Colunas, `select`,
  `from`, `orderBy` e fragmentos de `addRaw` são literais do código.
- `key` e `system` são reservadas no MySQL 8: escreva-as com crase.
- `IN (?)` com array depende do `pool.query` (protocolo texto) do adapter.
