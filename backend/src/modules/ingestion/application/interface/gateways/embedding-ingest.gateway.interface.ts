export interface EmbedChunkInput {
  chunkId: string;
  documentId: string;
  tenantId: string;
  filename: string;
  chunkIndex: number;
  content: string;
}

export interface EmbedChunkOutput {
  embeddingModel: string;
  embeddingVersion: string;
}

/** Fronteira do `ingestion` com o `embedding` — único jeito de embedar e persistir um chunk. */
export interface IEmbeddingIngestGateway {
  embedAndStore(input: EmbedChunkInput): Promise<EmbedChunkOutput>;
}
