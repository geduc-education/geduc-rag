import NotFound from '../../../../../@core/shared/exceptions/400/not-found-error';
import { IDocumentRepository } from '../../interface/repository/document.repository.interface';
import { IDocumentVectorsGateway } from '../../interface/gateways/document-vectors.gateway.interface';
import { IUseCase } from '../../../../../@core/shared/use-case.interface';

export interface DeleteDocumentInput {
  tenantId: string;
  documentId: string;
}

/**
 * Remove os vetores e depois o documento. Documento inexistente no tenant
 * responde 404 sem tocar no vector store.
 */
export class DeleteDocumentUseCase implements IUseCase {
  constructor(
    private readonly repository: IDocumentRepository,
    private readonly vectorsGateway: IDocumentVectorsGateway,
  ) {}

  async execute(input: DeleteDocumentInput): Promise<void> {
    const { tenantId, documentId } = input;
    const document = await this.repository.findById(tenantId, documentId);
    if (!document) throw new NotFound('Documento não encontrado.');

    await this.vectorsGateway.deleteByDocument(tenantId, documentId);
    const deleted = await this.repository.delete(tenantId, documentId);
    if (!deleted) throw new NotFound('Documento não encontrado.');
  }
}
