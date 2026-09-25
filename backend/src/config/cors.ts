/**
 * Resolve a configuração de `origin` do CORS a partir do env `CORS_ORIGINS`.
 *
 * - Em produção, `CORS_ORIGINS` é obrigatória: um CSV de origens com protocolo.
 * - Fora de produção, ausência → CORS permissivo (`true`) para facilitar o dev.
 */
export function parseCorsOrigins(
  raw: string | undefined,
  isProduction: boolean,
): string[] | boolean {
  const origins = (raw ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (origins.length > 0) {
    return origins;
  }

  if (isProduction) {
    throw new Error(
      'CORS_ORIGINS é obrigatória em produção (CSV de origens com protocolo).',
    );
  }

  return true;
}
