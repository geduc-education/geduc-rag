/**
 * Papel do texto no espaço de embedding: `query` (pergunta do usuário) ou `passage`
 * (chunk de documento). Modelos assimétricos (ex.: e5) usam prefixos distintos por papel.
 */
export type EmbeddingKind = 'query' | 'passage';

/** Fronteira com o provider de embedding (local/mock). Nunca chamado fora daqui. */
export interface IEmbeddingProviderGateway {
  embed(text: string, kind: EmbeddingKind): Promise<number[]>;
}
