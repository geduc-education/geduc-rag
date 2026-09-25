/** Fronteira com o provider de embedding (OpenAI/Cohere/etc). Nunca chamado fora daqui. */
export interface IEmbeddingProviderGateway {
  embed(text: string): Promise<number[]>;
}
