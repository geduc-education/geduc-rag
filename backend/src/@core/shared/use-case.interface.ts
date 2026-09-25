/**
 * Contrato dos use cases do RAG: classe pura, instanciada por `useFactory` no
 * `*.providers.ts` do módulo. O retorno é livre (síncrono ou `Promise`).
 */
export interface IUseCase {
  execute(input?: unknown): unknown;
}
