import { DocumentEntity } from '../../../domain/entities/document.entity';

export interface IDocumentRepository {
  create(document: DocumentEntity): Promise<void>;
  findById(
    tenantId: string,
    documentId: string,
  ): Promise<DocumentEntity | null>;
  save(document: DocumentEntity): Promise<void>;
  /** Página (1-based) dos documentos do tenant, ordenada por `createdAt` desc. */
  list(
    tenantId: string,
    page: number,
    limit: number,
  ): Promise<{ data: DocumentEntity[]; total: number }>;
  /** Remove o documento do tenant; `false` se ele não existe nesse tenant. */
  delete(tenantId: string, documentId: string): Promise<boolean>;
}
