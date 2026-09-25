import { Injectable } from '@nestjs/common';
import { EmbedAndStoreChunkUseCase } from '../../../embedding/application/usecase/embedding/embed-and-store-chunk.usecase';
import {
  EmbedChunkInput,
  EmbedChunkOutput,
  IEmbeddingIngestGateway,
} from '../../application/interface/gateways/embedding-ingest.gateway.interface';

@Injectable()
export class EmbeddingIngestGateway implements IEmbeddingIngestGateway {
  constructor(private readonly embedAndStoreChunk: EmbedAndStoreChunkUseCase) {}

  async embedAndStore(input: EmbedChunkInput): Promise<EmbedChunkOutput> {
    return await this.embedAndStoreChunk.execute(input);
  }
}
