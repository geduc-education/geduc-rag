import { ConfigService } from '@nestjs/config';
import { seconds } from '@nestjs/throttler';
import type { ThrottlerOptions } from '@nestjs/throttler';

/**
 * Throttlers NOMEADOS da plataforma (ThrottlerModule registrado SEM guard
 * global — nenhuma rota é limitada por padrão). Cada rota limitada aplica o
 * `ThrottlerGuard` com `@UseGuards`.
 *
 * `rag-query`: limite por IP do `POST /chat/query` — protege o CUSTO de LLM,
 * não só a infra (herdado do rag-api). Defaults 10 req / 60 s.
 */
export const RAG_QUERY_THROTTLER = 'rag-query';

export function buildThrottlerOptions(config: ConfigService): {
  throttlers: ThrottlerOptions[];
} {
  return {
    throttlers: [
      {
        name: RAG_QUERY_THROTTLER,
        ttl: seconds(config.get<number>('RAG_QUERY_THROTTLE_TTL') ?? 60),
        limit: config.get<number>('RAG_QUERY_THROTTLE_LIMIT') ?? 10,
      },
    ],
  };
}
