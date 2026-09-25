export interface UpsertChunkInput {
  chunkId: string;
  documentId: string;
  tenantId: string;
  filename: string;
  chunkIndex: number;
  content: string;
  vector: number[];
  embeddingModel: string;
}

/** Fronteira de ESCRITA do `embedding` com o vector store (leitura é do `retrieval`). */
export interface IVectorStoreGateway {
  upsertChunk(input: UpsertChunkInput): Promise<void>;
}
