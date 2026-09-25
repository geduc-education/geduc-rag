import {
  DocumentEntity,
  DocumentStatus,
} from '../../../domain/entities/document.entity';

/** Item de `GET /documents` — contrato HTTP consumido pelo frontend. */
export interface DocumentSummary {
  documentId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  errorMessage: string | null;
  /** ISO 8601. */
  createdAt: string;
}

export function toDocumentSummary(entity: DocumentEntity): DocumentSummary {
  return {
    documentId: entity.documentId,
    filename: entity.filename,
    mimeType: entity.mimeType,
    sizeBytes: entity.sizeBytes,
    status: entity.status,
    errorMessage: entity.errorMessage,
    createdAt: entity.createdAt.toISOString(),
  };
}
