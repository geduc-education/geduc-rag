import { Inject, Injectable } from '@nestjs/common';
import { VECTOR_STORE_CLIENT } from '../../../../@core/infra/vector-store/vector-store.module';
import type { VectorStoreClient } from '../../../../@core/infra/vector-store/vector-store.client';
import {
  IVectorStoreGateway,
  UpsertChunkInput,
} from '../../application/interface/gateways/vector-store.gateway.interface';

/** Encapsula o client de vector store (escrita) — vocabulário do domínio, sem vazar SDK. */
@Injectable()
export class VectorStoreGateway implements IVectorStoreGateway {
  constructor(
    @Inject(VECTOR_STORE_CLIENT)
    private readonly client: VectorStoreClient,
  ) {}

  async upsertChunk(input: UpsertChunkInput): Promise<void> {
    await this.client.upsert({
      chunkId: input.chunkId,
      documentId: input.documentId,
      tenantId: input.tenantId,
      filename: input.filename,
      chunkIndex: input.chunkIndex,
      content: input.content,
      vector: input.vector,
      embeddingModel: input.embeddingModel,
    });
  }
}
