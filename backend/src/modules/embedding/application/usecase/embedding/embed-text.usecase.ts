import {
  EmbeddingKind,
  IEmbeddingProviderGateway,
} from '../../interface/gateways/embedding-provider.gateway.interface';
import { EmbeddingVectorVO } from '../../../domain/entities/value-objects/embedding-vector.vo';
import EmbeddingProviderError from '../../../../../@core/shared/exceptions/502/embedding-provider-error';

/**
 * Embeda um texto cru (chunk de ingestão OU pergunta do usuário na consulta) — reusado por
 * `EmbedAndStoreChunkUseCase` (ingestão) e pelo gateway de embedding do `retrieval` (consulta).
 * Não implementa `IUseCase` porque recebe dois argumentos (texto e `EmbeddingKind`).
 */
export class EmbedTextUseCase {
  constructor(
    private readonly embeddingProviderGateway: IEmbeddingProviderGateway,
    private readonly dimensions: number,
  ) {}

  async execute(text: string, kind: EmbeddingKind): Promise<number[]> {
    try {
      const raw = await this.embeddingProviderGateway.embed(text, kind);
      return EmbeddingVectorVO.create(raw, this.dimensions).values;
    } catch (error) {
      if (error instanceof EmbeddingProviderError) throw error;
      throw new EmbeddingProviderError((error as Error).message);
    }
  }
}
