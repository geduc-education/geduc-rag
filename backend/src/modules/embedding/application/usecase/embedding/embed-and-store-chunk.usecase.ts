import { Logger } from '@nestjs/common';
import { EmbedTextUseCase } from './embed-text.usecase';
import { IVectorStoreGateway } from '../../interface/gateways/vector-store.gateway.interface';
import { IUseCase } from '../../../../../@core/shared/use-case.interface';

export interface EmbedAndStoreChunkInput {
  chunkId: string;
  documentId: string;
  tenantId: string;
  content: string;
}

export interface EmbedAndStoreChunkOutput {
  embeddingModel: string;
  embeddingVersion: string;
}

/** Não sabe de onde veio o chunk (documento/formato) — só embeda e persiste no vector store. */
export class EmbedAndStoreChunkUseCase implements IUseCase {
  private readonly logger = new Logger(EmbedAndStoreChunkUseCase.name);

  constructor(
    private readonly embedText: EmbedTextUseCase,
    private readonly vectorStoreGateway: IVectorStoreGateway,
    private readonly embeddingModel: string,
    private readonly embeddingVersion: string,
  ) {}

  async execute(
    input: EmbedAndStoreChunkInput,
  ): Promise<EmbedAndStoreChunkOutput> {
    const vector = await this.embedText.execute(input.content);
    await this.vectorStoreGateway.upsertChunk({
      chunkId: input.chunkId,
      documentId: input.documentId,
      tenantId: input.tenantId,
      content: input.content,
      vector,
    });
    this.logger.debug(
      `Chunk ${input.chunkId} embedado e persistido (modelo ${this.embeddingModel})`,
    );
    return {
      embeddingModel: this.embeddingModel,
      embeddingVersion: this.embeddingVersion,
    };
  }
}
