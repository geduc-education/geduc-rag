/** Fronteira do `documents` com a fila de ingestão — único jeito de disparar a ingestão. */
export interface IIngestionQueueGateway {
  enqueueIngestJob(tenantId: string, documentId: string): void;
}
