/**
 * Nomes de tópico e payloads da fila — compartilhados entre quem publica (`documents`) e
 * quem consome (`ingestion`) sem que um módulo importe o outro; análogo a um contrato de
 * mensagem de um broker real.
 */
export const INGEST_DOCUMENT_TOPIC = 'ingest-document';

export interface IngestDocumentJob {
  tenantId: string;
  documentId: string;
}
