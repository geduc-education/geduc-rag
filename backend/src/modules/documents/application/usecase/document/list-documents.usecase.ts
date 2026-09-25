import { IDocumentRepository } from '../../interface/repository/document.repository.interface';
import { IUseCase } from '../../../../../@core/shared/use-case.interface';
import { DocumentSummary, toDocumentSummary } from './document-summary';

export const DEFAULT_DOCUMENTS_PAGE = 1;
export const DEFAULT_DOCUMENTS_LIMIT = 20;

export interface ListDocumentsInput {
  tenantId: string;
  page?: number;
  limit?: number;
}

export interface ListDocumentsOutput {
  data: DocumentSummary[];
  total: number;
}

/** Página dos documentos do tenant (mais recentes primeiro). */
export class ListDocumentsUseCase implements IUseCase {
  constructor(private readonly repository: IDocumentRepository) {}

  async execute(input: ListDocumentsInput): Promise<ListDocumentsOutput> {
    const { data, total } = await this.repository.list(
      input.tenantId,
      input.page ?? DEFAULT_DOCUMENTS_PAGE,
      input.limit ?? DEFAULT_DOCUMENTS_LIMIT,
    );
    return { data: data.map(toDocumentSummary), total };
  }
}
