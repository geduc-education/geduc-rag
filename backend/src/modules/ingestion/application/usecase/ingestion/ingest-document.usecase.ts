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
      const { content } = await this.documentSourceGateway.getContent(
        tenantId,
        documentId,
      );
      const chunks = this.chunkingService.chunk(content);

      const { embeddingModel, embeddingVersion } = await this.embedChunks(
        tenantId,
        documentId,
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
      await this.documentStatusGateway.markFailed(tenantId, documentId);
      throw error;
    }
  }

  private async embedChunks(
    tenantId: string,
    documentId: string,
    chunks: string[],
  ): Promise<{ embeddingModel: string; embeddingVersion: string }> {
    let lastResult = { embeddingModel: '', embeddingVersion: '' };
    for (const [index, content] of chunks.entries()) {
      lastResult = await this.embeddingIngestGateway.embedAndStore({
        chunkId: `${documentId}:${index}`,
        documentId,
        tenantId,
        content,
      });
    }
    return lastResult;
  }
}
