import { Inject, Injectable } from '@nestjs/common';
import { VECTOR_STORE_CLIENT } from '../../../../@core/infra/vector-store/vector-store.module';
import { InMemoryVectorStoreClient } from '../../../../@core/infra/vector-store/in-memory-vector-store.client';
import {
  IVectorStoreGateway,
  UpsertChunkInput,
} from '../../application/interface/gateways/vector-store.gateway.interface';

/** Encapsula o client de vector store (escrita) — vocabulário do domínio, sem vazar SDK. */
@Injectable()
export class VectorStoreGateway implements IVectorStoreGateway {
  constructor(
    @Inject(VECTOR_STORE_CLIENT)
    private readonly client: InMemoryVectorStoreClient,
  ) {}

  async upsertChunk(input: UpsertChunkInput): Promise<void> {
    this.client.upsert({
      chunkId: input.chunkId,
      documentId: input.documentId,
      tenantId: input.tenantId,
      content: input.content,
      vector: input.vector,
    });
  }
}
