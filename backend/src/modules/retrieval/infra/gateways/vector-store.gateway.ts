import { Inject, Injectable } from '@nestjs/common';
import { VECTOR_STORE_CLIENT } from '../../../../@core/infra/vector-store/vector-store.module';
import type { VectorStoreClient } from '../../../../@core/infra/vector-store/vector-store.client';
import {
  ChunkSearchResult,
  IVectorSearchGateway,
} from '../../application/interface/gateways/vector-search.gateway.interface';

/** Encapsula o client de vector store (leitura) — busca sempre filtrada por tenant. */
@Injectable()
export class VectorStoreGateway implements IVectorSearchGateway {
  constructor(
    @Inject(VECTOR_STORE_CLIENT)
    private readonly client: VectorStoreClient,
  ) {}

  async searchSimilar(
    tenantId: string,
    queryVector: number[],
    topK: number,
  ): Promise<ChunkSearchResult[]> {
    const results = await this.client.search(tenantId, queryVector, topK);
    return results.map(({ record, score }) => ({
      chunkId: record.chunkId,
      documentId: record.documentId,
      filename: record.filename,
      content: record.content,
      score,
    }));
  }
}
