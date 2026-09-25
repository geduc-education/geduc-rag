import { Injectable } from '@nestjs/common';
import { EmbedTextUseCase } from '../../../embedding/application/usecase/embedding/embed-text.usecase';
import { IQueryEmbeddingGateway } from '../../application/interface/gateways/query-embedding.gateway.interface';

@Injectable()
export class QueryEmbeddingGateway implements IQueryEmbeddingGateway {
  constructor(private readonly embedText: EmbedTextUseCase) {}

  async embedQuery(text: string): Promise<number[]> {
    return await this.embedText.execute(text, 'query');
  }
}
