import NotFound from '../../../../../@core/shared/exceptions/400/not-found-error';
import { IDocumentRepository } from '../../interface/repository/document.repository.interface';
import { IUseCase } from '../../../../../@core/shared/use-case.interface';

export interface GetDocumentContentInput {
  tenantId: string;
  documentId: string;
}

export interface GetDocumentContentOutput {
  documentId: string;
  filename: string;
  content: string;
}

/**
 * Exportado para o `ingestion` consumir via gateway (`documents/infra/gateways` NÃO existe
 * aqui de propósito — quem encapsula esta chamada é o gateway do módulo CONSUMIDOR, conforme
 * a regra de fronteira cross-module).
 */
export class GetDocumentContentUseCase implements IUseCase {
  constructor(private readonly repository: IDocumentRepository) {}

  async execute(
    input: GetDocumentContentInput,
  ): Promise<GetDocumentContentOutput> {
    const document = await this.repository.findById(
      input.tenantId,
      input.documentId,
    );
    if (!document) throw new NotFound('Documento não encontrado.');
    return {
      documentId: document.documentId,
      filename: document.filename,
      content: document.content,
    };
  }
}
