import { RetrievedContextChunk } from './retrieval-context.gateway.interface';

export interface GenerationHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateAnswerRequest {
  question: string;
  contextChunks: RetrievedContextChunk[];
  history: GenerationHistoryTurn[];
}

export interface GeneratedAnswer {
  answer: string;
  inputTokens: number;
  outputTokens: number;
}

/** Fronteira do `chat` com o `generation` — único jeito de gerar a resposta. */
export interface IAnswerGenerationGateway {
  generate(request: GenerateAnswerRequest): Promise<GeneratedAnswer>;
}
