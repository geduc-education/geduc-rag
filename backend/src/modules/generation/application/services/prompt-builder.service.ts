import {
  buildRagAnswerPrompt,
  RagAnswerPromptContextChunk,
  RagAnswerPromptTurn,
} from '../prompts/rag-answer.prompt';

export interface BuildPromptInput {
  question: string;
  contextChunks: RagAnswerPromptContextChunk[];
  history: RagAnswerPromptTurn[];
}

/** Determinístico e testável sem chamar LLM real — dado o mesmo input, o prompt é sempre igual. */
export class PromptBuilderService {
  build(input: BuildPromptInput): string {
    return buildRagAnswerPrompt(input);
  }
}
