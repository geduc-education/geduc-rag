import BadRequest from '../../../../../@core/shared/exceptions/400/badrequest-error';

/**
 * Valida a dimensão do vetor na criação — prometer o tamanho errado silenciosamente é o
 * tipo de bug que só aparece no vector store, difícil de depurar depois.
 */
export class EmbeddingVectorVO {
  private constructor(
    readonly values: number[],
    readonly dimensions: number,
  ) {}

  static create(
    values: number[],
    expectedDimensions: number,
  ): EmbeddingVectorVO {
    if (values.length !== expectedDimensions) {
      throw new BadRequest(
        `Vetor de embedding com dimensão inválida: esperado ${expectedDimensions}, recebido ${values.length}.`,
      );
    }
    return new EmbeddingVectorVO(values, expectedDimensions);
  }
}
