/** UPDATE/DELETE recusado pela guarda antes de chegar ao banco. */
export class UnsafeMutationError extends Error {
  constructor(reason: string, sql: string) {
    super(`Mutação insegura (${reason}): ${sql}`);
    this.name = 'UnsafeMutationError';
  }
}

const COMMENT = /--|#|\/\*/;
const WHERE = /\bWHERE\b/i;
const TRIVIAL_CLAUSES = new Set(['1=1', 'true', "'1'='1'", '1', "'1'"]);
const COMPARISON =
  /=|<>|!=|<|>|\bIN\s*\(|\bIS\s+(NOT\s+)?NULL\b|\bLIKE\b|\bBETWEEN\b|\bEXISTS\b/i;

function normalizeClause(clause: string): string {
  return clause.replace(/[\s()]/g, '').toLowerCase();
}

/**
 * Recusa UPDATE/DELETE sem WHERE, com WHERE trivial (`1=1`, `TRUE`,
 * `'1'='1'`), com comentário SQL ou sem operador de comparação. Chamada por
 * `update`/`delete` do adapter e da conexão transacional.
 */
export function ensureSafeWhere(sql: string): void {
  if (COMMENT.test(sql)) throw new UnsafeMutationError('comentário', sql);
  const match = WHERE.exec(sql);
  if (!match) throw new UnsafeMutationError('sem WHERE', sql);
  const clause = sql.slice(match.index + match[0].length);
  if (TRIVIAL_CLAUSES.has(normalizeClause(clause))) {
    throw new UnsafeMutationError('WHERE trivial', sql);
  }
  if (!COMPARISON.test(clause)) {
    throw new UnsafeMutationError('WHERE sem comparação', sql);
  }
}
