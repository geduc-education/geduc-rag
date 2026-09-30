export interface VectorStoreRecord {
  chunkId: string;
  documentId: string;
  tenantId: string;
  /** Usado só pelo adapter in-memory; o adapter MySQL resolve o filename via join com `document`. */
  filename: string;
  chunkIndex: number;
  content: string;
  vector: number[];
  embeddingModel: string;
}

export interface VectorStoreSearchResult {
  record: VectorStoreRecord;
  score: number;
}

/**
 * Contrato do "SDK" de vector store — recurso de infra único (token `VECTOR_STORE_CLIENT`),
 * encapsulado pelo gateway PRÓPRIO de cada módulo consumidor (`embedding` escreve,
 * `retrieval` lê). Nunca é referenciado fora de `infra/gateways/` desses módulos.
 * Isolamento por tenant é OBRIGATÓRIO em toda busca e exclusão.
 */
export interface VectorStoreClient {
  upsert(record: VectorStoreRecord): Promise<void>;
  search(
    tenantId: string,
    queryVector: number[],
    topK: number,
  ): Promise<VectorStoreSearchResult[]>;
  deleteByDocument(tenantId: string, documentId: string): Promise<void>;
}
