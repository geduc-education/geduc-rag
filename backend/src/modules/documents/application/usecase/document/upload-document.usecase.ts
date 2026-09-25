import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { DocumentEntity } from '../../../domain/entities/document.entity';
import { IDocumentRepository } from '../../interface/repository/document.repository.interface';
import { IIngestionQueueGateway } from '../../interface/gateways/ingestion-queue.gateway.interface';
import { ITextExtractorGateway } from '../../interface/gateways/text-extractor.gateway.interface';
import { IUseCase } from '../../../../../@core/shared/use-case.interface';

export interface UploadDocumentInput {
  tenantId: string;
  userId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
}

export interface UploadDocumentOutput {
  documentId: string;
  status: string;
}

/**
 * Extrai o texto do arquivo (síncrono no request: formato inválido ou sem
 * texto responde 400 na hora), cria o documento `pending` e enfileira a
 * ingestão — nunca processa chunks/embeddings inline.
 */
export class UploadDocumentUseCase implements IUseCase {
  private readonly logger = new Logger(UploadDocumentUseCase.name);

  constructor(
    private readonly repository: IDocumentRepository,
    private readonly textExtractor: ITextExtractorGateway,
    private readonly ingestionQueueGateway: IIngestionQueueGateway,
  ) {}

  async execute(input: UploadDocumentInput): Promise<UploadDocumentOutput> {
    const content = await this.textExtractor.extract({
      filename: input.filename,
      mimeType: input.mimeType,
      buffer: input.buffer,
    });
    try {
      const document = DocumentEntity.create({
        documentId: randomUUID(),
        tenantId: input.tenantId,
        createdById: input.userId,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        content,
      });
      await this.repository.create(document);
      this.ingestionQueueGateway.enqueueIngestJob(
        document.tenantId,
        document.documentId,
      );
      return { documentId: document.documentId, status: document.status };
    } catch (error) {
      this.logger.error('Erro ao criar documento', error);
      throw error;
    }
  }
}
