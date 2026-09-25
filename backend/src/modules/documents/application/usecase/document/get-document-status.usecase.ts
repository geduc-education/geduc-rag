import NotFound from '../../../../../@core/shared/exceptions/400/not-found-error';
import { IDocumentRepository } from '../../interface/repository/document.repository.interface';
import { IUseCase } from '../../../../../@core/shared/use-case.interface';

export interface GetDocumentStatusInput {
  tenantId: string;
  documentId: string;
}

export interface GetDocumentStatusOutput {
  documentId: string;
  status: string;
}

export class GetDocumentStatusUseCase implements IUseCase {
  constructor(private readonly repository: IDocumentRepository) {}

  async execute(
    input: GetDocumentStatusInput,
  ): Promise<GetDocumentStatusOutput> {
    const document = await this.repository.findById(
      input.tenantId,
      input.documentId,
    );
    if (!document) throw new NotFound('Documento não encontrado.');
    return { documentId: document.documentId, status: document.status };
  }
}
