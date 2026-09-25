export interface LlmGenerateInput {
  prompt: string;
  maxOutputTokens: number;
}

export interface LlmGenerateOutput {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/** Fronteira com o provider de LLM (OpenAI/Anthropic/etc). Nunca chamado fora daqui. */
export interface ILlmProviderGateway {
  generate(input: LlmGenerateInput): Promise<LlmGenerateOutput>;
}
