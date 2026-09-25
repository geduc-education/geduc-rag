import { ConfigService } from '@nestjs/config';
import { VECTOR_STORE_CLIENT } from '../../@core/infra/vector-store/vector-store.module';
import { InMemoryVectorStoreClient } from '../../@core/infra/vector-store/in-memory-vector-store.client';
import { EmbedTextUseCase } from '../embedding/application/usecase/embedding/embed-text.usecase';
import { QueryEmbeddingGateway } from './infra/gateways/query-embedding.gateway';
import { VectorStoreGateway } from './infra/gateways/vector-store.gateway';
import { IQueryEmbeddingGateway } from './application/interface/gateways/query-embedding.gateway.interface';
import { IVectorSearchGateway } from './application/interface/gateways/vector-search.gateway.interface';
import { SearchChunksQueryService } from './application/query-service/chunk/search-chunks.queryservice';
import { RetrieveContextUseCase } from './application/usecase/retrieval/retrieve-context.usecase';

export namespace RETRIEVAL_PROVIDERS {
  export namespace GATEWAY {
    export const QUERY_EMBEDDING_GATEWAY = {
      provide: 'IQueryEmbeddingGateway',
      useFactory: (embedText: EmbedTextUseCase) =>
        new QueryEmbeddingGateway(embedText),
      inject: [EmbedTextUseCase],
    };

    export const VECTOR_SEARCH_GATEWAY = {
      provide: 'IVectorSearchGateway',
      useFactory: (client: InMemoryVectorStoreClient) =>
        new VectorStoreGateway(client),
      inject: [VECTOR_STORE_CLIENT],
    };
  }

  export namespace QUERY_SERVICES {
    export const SEARCH_CHUNKS = {
      provide: SearchChunksQueryService,
      useFactory: (gateway: IVectorSearchGateway) =>
        new SearchChunksQueryService(gateway),
      inject: [GATEWAY.VECTOR_SEARCH_GATEWAY.provide],
    };
  }

  export namespace USE_CASES {
    export const RETRIEVE_CONTEXT = {
      provide: RetrieveContextUseCase,
      useFactory: (
        queryEmbeddingGateway: IQueryEmbeddingGateway,
        searchChunks: SearchChunksQueryService,
        config: ConfigService,
      ) =>
        new RetrieveContextUseCase(
          queryEmbeddingGateway,
          searchChunks,
          config.get<number>('RETRIEVAL_TOP_K')!,
        ),
      inject: [
        GATEWAY.QUERY_EMBEDDING_GATEWAY.provide,
        QUERY_SERVICES.SEARCH_CHUNKS.provide,
        ConfigService,
      ],
    };
  }
}
