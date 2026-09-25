import { MessageCitation } from '../../../domain/entities/message.entity';

export interface RetrievedContextChunk {
  documentId: string;
  content: string;
}

export interface RetrievedContext {
  contextChunks: RetrievedContextChunk[];
  citations: MessageCitation[];
}

/** Fronteira do `chat` com o `retrieval` — único jeito de obter contexto para a pergunta. */
export interface IRetrievalContextGateway {
  retrieve(tenantId: string, question: string): Promise<RetrievedContext>;
}
