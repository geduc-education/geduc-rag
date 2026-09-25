/** Fronteira do `retrieval` com o `embedding` — único jeito de embedar a pergunta do usuário. */
export interface IQueryEmbeddingGateway {
  embedQuery(text: string): Promise<number[]>;
}
