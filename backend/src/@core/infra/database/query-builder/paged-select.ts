import type { FilterContext } from './filters';
import { CompiledQuery, InvalidQueryError, toPositional } from './sql-params';

export interface PageRequest {
  page: number;
  limit: number;
}

/** Query da página e query de contagem, com o mesmo WHERE. */
export interface PagedQuery {
  page: CompiledQuery;
  count: CompiledQuery;
}

export interface PagedSelectInput {
  select: string;
  from: string;
  ctx: FilterContext;
  orderBy: string;
  allowedOrderBy: readonly string[];
  page: PageRequest;
  maxLimit?: number;
}

const DEFAULT_MAX_LIMIT = 100;

function isIntInRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

function assertValid(input: PagedSelectInput): void {
  if (!input.allowedOrderBy.includes(input.orderBy)) {
    throw new InvalidQueryError(`Ordenação não permitida: ${input.orderBy}`);
  }
  const maxLimit = input.maxLimit ?? DEFAULT_MAX_LIMIT;
  const { page, limit } = input.page;
  if (!isIntInRange(page, 1, Number.MAX_SAFE_INTEGER)) {
    throw new InvalidQueryError('page deve ser inteiro >= 1');
  }
  if (!isIntInRange(limit, 1, maxLimit)) {
    throw new InvalidQueryError(`limit deve ser inteiro entre 1 e ${maxLimit}`);
  }
}

/**
 * Monta SELECT paginado e COUNT com o mesmo WHERE. `orderBy` precisa estar na
 * allow-list; LIMIT/OFFSET vão como params numéricos, nunca interpolados.
 */
export function buildPagedSelect(input: PagedSelectInput): PagedQuery {
  assertValid(input);
  const { select, from, ctx, orderBy } = input;
  const { page, limit } = input.page;
  const where = ctx.where.length ? ` WHERE ${ctx.where.join(' AND ')}` : '';

  const pageQuery = toPositional(
    `SELECT ${select} FROM ${from}${where} ORDER BY ${orderBy}`,
    ctx.params,
  );
  const count = toPositional(
    `SELECT COUNT(*) AS total FROM ${from}${where}`,
    ctx.params,
  );
  return {
    page: {
      sql: `${pageQuery.sql} LIMIT ? OFFSET ?`,
      params: [...pageQuery.params, limit, (page - 1) * limit],
    },
    count,
  };
}
