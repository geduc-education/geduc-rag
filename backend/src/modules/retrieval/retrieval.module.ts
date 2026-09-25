import { Module } from '@nestjs/common';
import { EmbeddingModule } from '../embedding/embedding.module';
import { RETRIEVAL_PROVIDERS } from './retrieval.providers';
import { RetrieveContextUseCase } from './application/usecase/retrieval/retrieve-context.usecase';
import { SearchChunksQueryService } from './application/query-service/chunk/search-chunks.queryservice';

/** Só leitura. Consome `embedding` (embedar a pergunta) via gateway próprio. */
@Module({
  imports: [EmbeddingModule],
  providers: [
    ...Object.values(RETRIEVAL_PROVIDERS.GATEWAY),
    ...Object.values(RETRIEVAL_PROVIDERS.QUERY_SERVICES),
    ...Object.values(RETRIEVAL_PROVIDERS.USE_CASES),
  ],
  exports: [RetrieveContextUseCase, SearchChunksQueryService],
})
export class RetrievalModule {}
