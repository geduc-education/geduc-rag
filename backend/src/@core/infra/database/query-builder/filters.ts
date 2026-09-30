/** Condições do WHERE (unidas por AND) e os valores nomeados que elas usam. */
export interface FilterContext {
  where: string[];
  params: Record<string, unknown>;
}

export function createFilterContext(): FilterContext {
  return { where: [], params: {} };
}

/** `column = :name`; ignora `undefined` e `null`, mantém `0` e `false`. */
export function addEq(
  ctx: FilterContext,
  column: string,
  name: string,
  value: unknown,
): void {
  if (value === undefined || value === null) return;
  ctx.where.push(`${column} = :${name}`);
  ctx.params[name] = value;
}

/** `column IN (:name)`; `undefined` ignora e lista vazia vira `1 = 0` (nunca `IN ()`). */
export function addIn(
  ctx: FilterContext,
  column: string,
  name: string,
  values: readonly unknown[] | undefined,
): void {
  if (values === undefined) return;
  if (values.length === 0) {
    ctx.where.push('1 = 0');
    return;
  }
  ctx.where.push(`${column} IN (:${name})`);
  ctx.params[name] = [...values];
}

function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * `(c1 LIKE :name OR c2 LIKE :name)` com `%termo%` escapado — equivale ao
 * `contains` do Prisma. Termo vazio (após `trim`) ignora.
 */
export function addLike(
  ctx: FilterContext,
  columns: readonly string[],
  name: string,
  term: string | undefined,
): void {
  const trimmed = term?.trim();
  if (!trimmed || columns.length === 0) return;
  const conditions = columns.map((column) => `${column} LIKE :${name}`);
  ctx.where.push(`(${conditions.join(' OR ')})`);
  ctx.params[name] = `%${escapeLike(trimmed)}%`;
}

/** Fragmento fixo escrito no código (ex.: `u.deleted_at IS NULL`); nunca input do usuário. */
export function addRaw(
  ctx: FilterContext,
  fragment: string,
  params?: Record<string, unknown>,
): void {
  ctx.where.push(fragment);
  if (params) Object.assign(ctx.params, params);
}
