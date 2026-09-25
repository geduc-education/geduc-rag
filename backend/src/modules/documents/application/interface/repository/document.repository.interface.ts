import { DocumentEntity } from '../../../domain/entities/document.entity';

export interface IDocumentRepository {
  create(document: DocumentEntity): Promise<void>;
  findById(
    tenantId: string,
    documentId: string,
  ): Promise<DocumentEntity | null>;
  save(document: DocumentEntity): Promise<void>;
}
