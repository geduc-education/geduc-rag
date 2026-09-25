/** Fronteira do `ingestion` com o `documents` — única forma de refletir o progresso da ingestão. */
export interface IDocumentStatusGateway {
  markProcessing(tenantId: string, documentId: string): Promise<void>;
  markReady(
    tenantId: string,
    documentId: string,
    embeddingModel: string,
    embeddingVersion: string,
  ): Promise<void>;
  markFailed(
    tenantId: string,
    documentId: string,
    reason?: string,
  ): Promise<void>;
}
