/** Código textual do driver mysql2 para violação de chave única. */
const MYSQL_DUPLICATE_ENTRY_CODE = 'ER_DUP_ENTRY';

/** `errno` do MySQL para violação de chave única. */
const MYSQL_DUPLICATE_ENTRY_ERRNO = 1062;

/**
 * Reconhece a violação de UNIQUE do MySQL pelo par `code`/`errno` — nunca pelo
 * texto da mensagem, que muda com a versão do servidor e com o idioma.
 */
export function isMysqlDuplicateEntry(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, errno } = error as { code?: unknown; errno?: unknown };
  return (
    code === MYSQL_DUPLICATE_ENTRY_CODE || errno === MYSQL_DUPLICATE_ENTRY_ERRNO
  );
}
