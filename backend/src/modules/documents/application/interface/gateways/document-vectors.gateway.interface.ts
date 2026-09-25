/** Fronteira do `documents` com o vector store — remove os chunks de um documento. */
export interface IDocumentVectorsGateway {
  /** Remove todos os vetores do documento, sempre escopado ao tenant. */
  deleteByDocument(tenantId: string, documentId: string): Promise<void>;
}

export const DOCUMENT_VECTORS_GATEWAY = 'IDocumentVectorsGateway';
