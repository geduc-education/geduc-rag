import {
  ChunkSearchResult,
  IVectorSearchGateway,
} from '../../interface/gateways/vector-search.gateway.interface';

/**
 * Compõe a leitura do vector store. Reranking real ainda não existe (`RERANK_ENABLED` fica
 * documentado no `.env.example` como feature flag para quando houver um reranker de
 * verdade) — hoje a ordem é sempre a de similaridade do vector store, sem reordenação fake.
 */
export class SearchChunksQueryService {
  constructor(private readonly vectorSearchGateway: IVectorSearchGateway) {}

  async search(
    tenantId: string,
    queryVector: number[],
    topK: number,
  ): Promise<ChunkSearchResult[]> {
    return await this.vectorSearchGateway.searchSimilar(
      tenantId,
      queryVector,
      topK,
    );
  }
}
