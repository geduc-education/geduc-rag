import NotFound from '../../../../../@core/shared/exceptions/400/not-found-error';
import { IDocumentRepository } from '../../interface/repository/document.repository.interface';
import { IUseCase } from '../../../../../@core/shared/use-case.interface';

export interface UpdateDocumentStatusInput {
  tenantId: string;
  documentId: string;
  status: 'processing' | 'ready' | 'failed';
  embeddingModel?: string;
  embeddingVersion?: string;
  /** Motivo da falha (só com `status: 'failed'`); truncado pela entidade. */
  reason?: string;
}

/** Exportado para o `ingestion` refletir o progresso da ingestão de volta no documento. */
export class UpdateDocumentStatusUseCase implements IUseCase {
  constructor(private readonly repository: IDocumentRepository) {}

  async execute(input: UpdateDocumentStatusInput): Promise<void> {
    const document = await this.repository.findById(
      input.tenantId,
      input.documentId,
    );
    if (!document) throw new NotFound('Documento não encontrado.');

    if (input.status === 'processing') document.markProcessing();
    else if (input.status === 'ready') {
      document.markReady(
        input.embeddingModel ?? '',
        input.embeddingVersion ?? '',
      );
    } else document.markFailed(input.reason);

    await this.repository.save(document);
  }
}
