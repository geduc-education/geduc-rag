import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DATABASE_CONNECTION,
  IDatabaseConnection,
} from '../../application/adapters/database-connection.interface';
import { InMemoryVectorStoreClient } from './in-memory-vector-store.client';
import { MysqlVectorStoreClient } from './mysql-vector-store.client';
import { VectorStoreClient } from './vector-store.client';

export const VECTOR_STORE_CLIENT = 'VECTOR_STORE_CLIENT';

/**
 * Recurso de infra global — provê o client de vector store para os gateways de
 * `embedding` (escrita) e `retrieval` (leitura). `RAG_STORAGE=memory` usa o adapter
 * in-memory (e2e e dev sem banco); qualquer outro valor usa o adapter MySQL.
 */
@Global()
@Module({
  providers: [
    {
      provide: VECTOR_STORE_CLIENT,
      inject: [ConfigService, DATABASE_CONNECTION],
      useFactory: (
        config: ConfigService,
        connection: IDatabaseConnection,
      ): VectorStoreClient =>
        config.get<string>('RAG_STORAGE') === 'memory'
          ? new InMemoryVectorStoreClient()
          : new MysqlVectorStoreClient(connection),
    },
  ],
  exports: [VECTOR_STORE_CLIENT],
})
export class VectorStoreModule {}
