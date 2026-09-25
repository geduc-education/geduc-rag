import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IEmbeddingProviderGateway } from '../../application/interface/gateways/embedding-provider.gateway.interface';

/**
 * Mock determinístico (hash do texto → vetor pseudo-aleatório na dimensão configurada).
 * Ver `CLAUDE.md` ("Estado atual") — troca por gateway real (OpenAI/Cohere) atrás da mesma
 * interface, sem tocar nos use cases que a consomem.
 */
@Injectable()
export class EmbeddingProviderGateway implements IEmbeddingProviderGateway {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async embed(text: string): Promise<number[]> {
    const dimensions = this.config.get<number>('EMBEDDING_DIMENSIONS')!;
    const seed = createHash('sha256').update(text).digest();
    return Array.from({ length: dimensions }, (_, i) => {
      const byte = seed[i % seed.length];
      return (byte / 255) * 2 - 1;
    });
  }
}
