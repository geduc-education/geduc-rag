import { Injectable } from '@nestjs/common';
import { UpdateDocumentStatusUseCase } from '../../../documents/application/usecase/document/update-document-status.usecase';
import { IDocumentStatusGateway } from '../../application/interface/gateways/document-status.gateway.interface';

@Injectable()
export class DocumentStatusGateway implements IDocumentStatusGateway {
  constructor(
    private readonly updateDocumentStatus: UpdateDocumentStatusUseCase,
  ) {}

  async markProcessing(tenantId: string, documentId: string): Promise<void> {
    await this.updateDocumentStatus.execute({
      tenantId,
      documentId,
      status: 'processing',
    });
  }

  async markReady(
    tenantId: string,
    documentId: string,
    embeddingModel: string,
    embeddingVersion: string,
  ): Promise<void> {
    await this.updateDocumentStatus.execute({
      tenantId,
      documentId,
      status: 'ready',
      embeddingModel,
      embeddingVersion,
    });
  }

  async markFailed(tenantId: string, documentId: string): Promise<void> {
    await this.updateDocumentStatus.execute({
      tenantId,
      documentId,
      status: 'failed',
    });
  }
}
