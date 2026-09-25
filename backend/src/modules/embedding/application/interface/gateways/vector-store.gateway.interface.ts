export interface UpsertChunkInput {
  chunkId: string;
  documentId: string;
  tenantId: string;
  content: string;
  vector: number[];
}

/** Fronteira de ESCRITA do `embedding` com o vector store (leitura é do `retrieval`). */
export interface IVectorStoreGateway {
  upsertChunk(input: UpsertChunkInput): Promise<void>;
}
