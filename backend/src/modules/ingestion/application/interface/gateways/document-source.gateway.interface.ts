export interface DocumentSource {
  filename: string;
  content: string;
}

/** Fronteira do `ingestion` com o `documents` — única forma de ler o conteúdo do documento. */
export interface IDocumentSourceGateway {
  getContent(tenantId: string, documentId: string): Promise<DocumentSource>;
}
