import { Logger } from '@nestjs/common';
import { ChunkingService } from '../../services/chunking.service';
import { IDocumentSourceGateway } from '../../interface/gateways/document-source.gateway.interface';
import { IDocumentStatusGateway } from '../../interface/gateways/document-status.gateway.interface';
import { IEmbeddingIngestGateway } from '../../interface/gateways/embedding-ingest.gateway.interface';
import { IUseCase } from '../../../../../@core/shared/use-case.interface';

export interface IngestDocumentInput {
  tenantId: string;
  documentId: string;
}

/**
 * Orquestra parsing (documento já vem como texto — sem parser de PDF/DOCX configurado
 * ainda) → chunking → embedding de cada chunk. Reflete o progresso de volta no documento
 * via `IDocumentStatusGateway`. Nunca roda no request HTTP — só a partir do queue processor.
 */
export class IngestDocumentUseCase implements IUseCase {
  private readonly logger = new Logger(IngestDocumentUseCase.name);

  constructor(
    private readonly documentSourceGateway: IDocumentSourceGateway,
    private readonly chunkingService: ChunkingService,
    private readonly embeddingIngestGateway: IEmbeddingIngestGateway,
    private readonly documentStatusGateway: IDocumentStatusGateway,
  ) {}

  async execute(input: IngestDocumentInput): Promise<void> {
    const { tenantId, documentId } = input;
    try {
      await this.documentStatusGateway.markProcessing(tenantId, documentId);
      const { filename, content } = await this.documentSourceGateway.getContent(
        tenantId,
        documentId,
      );
      const chunks = this.chunkingService.chunk(content);

      const { embeddingModel, embeddingVersion } = await this.embedChunks(
        { tenantId, documentId, filename },
        chunks,
      );

      await this.documentStatusGateway.markReady(
        tenantId,
        documentId,
        embeddingModel,
        embeddingVersion,
      );
    } catch (error) {
      this.logger.error(`Falha ao ingerir documento ${documentId}`, error);
      await this.markFailedSafely(tenantId, documentId, error);
      throw error;
    }
  }

  /**
   * Registra a falha sem mascarar o erro original: se o documento foi excluído no meio
   * da ingestão, o `markFailed` rejeita (NotFound) e isso só é logado.
   */
  private async markFailedSafely(
    tenantId: string,
    documentId: string,
    error: unknown,
  ): Promise<void> {
    const reason = error instanceof Error ? error.message : String(error);
    try {
      await this.documentStatusGateway.markFailed(tenantId, documentId, reason);
    } catch (markError) {
      this.logger.warn(
        `Não foi possível marcar o documento ${documentId} como failed`,
        markError,
      );
    }
  }

  private async embedChunks(
    source: { tenantId: string; documentId: string; filename: string },
    chunks: string[],
  ): Promise<{ embeddingModel: string; embeddingVersion: string }> {
    const { tenantId, documentId, filename } = source;
    let lastResult = { embeddingModel: '', embeddingVersion: '' };
    for (const [index, content] of chunks.entries()) {
      lastResult = await this.embeddingIngestGateway.embedAndStore({
        chunkId: `${documentId}:${index}`,
        documentId,
        tenantId,
        filename,
        chunkIndex: index,
        content,
      });
    }
    return lastResult;
  }
}
