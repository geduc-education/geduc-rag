/** SQL com placeholders posicionais (`?`) e os valores na mesma ordem. */
export interface CompiledQuery {
  sql: string;
  params: unknown[];
}

/** Query montada de forma inválida (parâmetro ausente, ordenação ou paginação fora do permitido). */
export class InvalidQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidQueryError';
  }
}

const NAMED_PLACEHOLDER = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;

/**
 * Troca cada `:nome` por `?` na ordem de ocorrência; nome repetido repete o
 * valor. Lança `InvalidQueryError` se algum `:nome` não tiver chave em `named`.
 */
export function toPositional(
  sql: string,
  named: Record<string, unknown>,
): CompiledQuery {
  const params: unknown[] = [];
  const positional = sql.replace(NAMED_PLACEHOLDER, (_match, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(named, name)) {
      throw new InvalidQueryError(`Parâmetro ausente para :${name}`);
    }
    params.push(named[name]);
    return '?';
  });
  return { sql: positional, params };
}
