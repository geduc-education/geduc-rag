import { Module } from '@nestjs/common';
import { EMBEDDING_PROVIDERS } from './embedding.providers';
import { EmbedTextUseCase } from './application/usecase/embedding/embed-text.usecase';
import { EmbedAndStoreChunkUseCase } from './application/usecase/embedding/embed-and-store-chunk.usecase';

/**
 * Gera embeddings e persiste vetores. Não sabe de onde vem o chunk (`ingestion`) nem quem
 * busca depois (`retrieval`) — só exporta os dois use cases que essas fronteiras consomem
 * via gateway PRÓPRIO de cada módulo consumidor.
 */
@Module({
  providers: [
    ...Object.values(EMBEDDING_PROVIDERS.GATEWAY),
    ...Object.values(EMBEDDING_PROVIDERS.USE_CASES),
  ],
  exports: [EmbedTextUseCase, EmbedAndStoreChunkUseCase],
})
export class EmbeddingModule {}
