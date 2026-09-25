export interface ChunkSearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  score: number;
}

/** Fronteira de LEITURA do `retrieval` com o vector store (escrita é do `embedding`). */
export interface IVectorSearchGateway {
  searchSimilar(
    tenantId: string,
    queryVector: number[],
    topK: number,
  ): Promise<ChunkSearchResult[]>;
}
