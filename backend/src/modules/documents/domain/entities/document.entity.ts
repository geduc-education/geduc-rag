import BadRequest from '../../../../@core/shared/exceptions/400/badrequest-error';

export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed';

/** Limite de caracteres do motivo de falha gravado em `errorMessage`. */
export const DOCUMENT_ERROR_MESSAGE_MAX_LENGTH = 500;

export interface DocumentProps {
  documentId: string;
  tenantId: string;
  filename: string;
  content: string;
  /** Default `text/plain`. */
  mimeType?: string;
  /** Default: bytes UTF-8 de `content`. */
  sizeBytes?: number;
  createdById?: string | null;
  status?: DocumentStatus;
  errorMessage?: string | null;
  embeddingModel?: string | null;
  embeddingVersion?: string | null;
  createdAt?: Date;
}

/**
 * Documento fonte da ingestão. `content` fica inline (sem storage de arquivo tipo S3
 * configurado ainda — ver `CLAUDE.md`, "Estado atual"); quando houver, esta entidade troca
 * `content` por uma referência de storage sem afetar os use cases que só leem `content`.
 */
export class DocumentEntity {
  readonly documentId: string;
  readonly tenantId: string;
  readonly filename: string;
  readonly content: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly createdById: string | null;
  status: DocumentStatus;
  errorMessage: string | null;
  embeddingModel: string | null;
  embeddingVersion: string | null;
  readonly createdAt: Date;

  private constructor(props: DocumentProps) {
    this.documentId = props.documentId;
    this.tenantId = props.tenantId;
    this.filename = props.filename;
    this.content = props.content;
    this.mimeType = props.mimeType ?? 'text/plain';
    this.sizeBytes =
      props.sizeBytes ?? Buffer.byteLength(props.content ?? '', 'utf8');
    this.createdById = props.createdById ?? null;
    this.status = props.status ?? 'pending';
    this.errorMessage = props.errorMessage ?? null;
    this.embeddingModel = props.embeddingModel ?? null;
    this.embeddingVersion = props.embeddingVersion ?? null;
    this.createdAt = props.createdAt ?? new Date();
  }

  static create(props: DocumentProps): DocumentEntity {
    const entity = new DocumentEntity(props);
    entity.validate();
    return entity;
  }

  markProcessing(): void {
    this.status = 'processing';
    this.errorMessage = null;
  }

  markReady(embeddingModel: string, embeddingVersion: string): void {
    this.status = 'ready';
    this.embeddingModel = embeddingModel;
    this.embeddingVersion = embeddingVersion;
    this.errorMessage = null;
  }

  /** Marca a falha; `reason` é truncado em {@link DOCUMENT_ERROR_MESSAGE_MAX_LENGTH} caracteres. */
  markFailed(reason?: string): void {
    this.status = 'failed';
    this.errorMessage = reason
      ? reason.slice(0, DOCUMENT_ERROR_MESSAGE_MAX_LENGTH)
      : null;
  }

  private validate(): void {
    if (!this.filename?.trim())
      throw new BadRequest('Campo filename é obrigatório.');
    if (!this.content?.trim())
      throw new BadRequest('Campo content é obrigatório.');
  }
}
