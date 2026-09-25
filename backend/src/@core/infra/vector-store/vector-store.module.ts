import { Global, Module } from '@nestjs/common';
import { InMemoryVectorStoreClient } from './in-memory-vector-store.client';

export const VECTOR_STORE_CLIENT = 'VECTOR_STORE_CLIENT';

/**
 * Recurso de infra global (como o `DatabaseModule` do geduc-api) — provê o client de
 * vector store para os gateways de `embedding` (escrita) e `retrieval` (leitura).
 * Trocar `InMemoryVectorStoreClient` por um client real de pgvector/Pinecone/Qdrant não
 * deveria exigir alterações fora deste módulo.
 */
@Global()
@Module({
  providers: [
    { provide: VECTOR_STORE_CLIENT, useClass: InMemoryVectorStoreClient },
  ],
  exports: [VECTOR_STORE_CLIENT],
})
export class VectorStoreModule {}
