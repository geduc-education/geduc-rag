import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { DocumentEntity } from '../../../domain/entities/document.entity';
import { IDocumentRepository } from '../../interface/repository/document.repository.interface';
import { IIngestionQueueGateway } from '../../interface/gateways/ingestion-queue.gateway.interface';
import { IUseCase } from '../../../../../@core/shared/use-case.interface';

export interface UploadDocumentInput {
  tenantId: string;
  filename: string;
  content: string;
}

export interface UploadDocumentOutput {
  documentId: string;
  status: string;
}

/** Cria o documento (status `pending`) e enfileira o job de ingestão — nunca processa inline. */
export class UploadDocumentUseCase implements IUseCase {
  private readonly logger = new Logger(UploadDocumentUseCase.name);

  constructor(
    private readonly repository: IDocumentRepository,
    private readonly ingestionQueueGateway: IIngestionQueueGateway,
  ) {}

  async execute(input: UploadDocumentInput): Promise<UploadDocumentOutput> {
    try {
      const document = DocumentEntity.create({
        documentId: randomUUID(),
        tenantId: input.tenantId,
        filename: input.filename,
        content: input.content,
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
