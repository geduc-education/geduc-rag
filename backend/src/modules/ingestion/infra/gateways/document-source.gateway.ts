import { Injectable } from '@nestjs/common';
import { GetDocumentContentUseCase } from '../../../documents/application/usecase/document/get-document-content.usecase';
import {
  DocumentSource,
  IDocumentSourceGateway,
} from '../../application/interface/gateways/document-source.gateway.interface';

@Injectable()
export class DocumentSourceGateway implements IDocumentSourceGateway {
  constructor(private readonly getDocumentContent: GetDocumentContentUseCase) {}

  async getContent(
    tenantId: string,
    documentId: string,
  ): Promise<DocumentSource> {
    const document = await this.getDocumentContent.execute({
      tenantId,
      documentId,
    });
    return { filename: document.filename, content: document.content };
  }
}
