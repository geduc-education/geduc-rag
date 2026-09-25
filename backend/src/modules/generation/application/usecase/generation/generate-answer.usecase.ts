import { Logger } from '@nestjs/common';
import { PromptBuilderService } from '../../services/prompt-builder.service';
import { ILlmProviderGateway } from '../../interface/gateways/llm-provider.gateway.interface';
import {
  RagAnswerPromptContextChunk,
  RagAnswerPromptTurn,
} from '../../prompts/rag-answer.prompt';
import { IUseCase } from '../../../../../@core/shared/use-case.interface';
import ContextWindowExceeded from '../../../../../@core/shared/exceptions/400/context-window-exceeded-error';
import LlmProviderError from '../../../../../@core/shared/exceptions/502/llm-provider-error';

export interface GenerateAnswerInput {
  question: string;
  contextChunks: RagAnswerPromptContextChunk[];
  history: RagAnswerPromptTurn[];
}

export interface GenerateAnswerOutput {
  answer: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

/** Observability de custo é parte do use case: loga tokens consumidos e latência do provider. */
export class GenerateAnswerUseCase implements IUseCase {
  private readonly logger = new Logger(GenerateAnswerUseCase.name);

  constructor(
    private readonly promptBuilder: PromptBuilderService,
    private readonly llmProviderGateway: ILlmProviderGateway,
    private readonly maxOutputTokens: number,
    private readonly contextWindowTokens: number,
  ) {}

  async execute(input: GenerateAnswerInput): Promise<GenerateAnswerOutput> {
    const prompt = this.promptBuilder.build(input);
    this.assertFitsContextWindow(prompt);

    const startedAt = Date.now();
    try {
      const result = await this.llmProviderGateway.generate({
        prompt,
        maxOutputTokens: this.maxOutputTokens,
      });
      const latencyMs = Date.now() - startedAt;
      this.logger.log(
        `Geração concluída: inputTokens=${result.inputTokens} outputTokens=${result.outputTokens} latencyMs=${latencyMs}`,
      );
      return {
        answer: result.text,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        latencyMs,
      };
    } catch (error) {
      if (error instanceof LlmProviderError) throw error;
      throw new LlmProviderError((error as Error).message);
    }
  }

  /** Heurística simples (chars/4) — suficiente para rejeitar antes de gastar a chamada ao provider. */
  private assertFitsContextWindow(prompt: string): void {
    const estimatedPromptTokens = Math.ceil(prompt.length / 4);
    if (
      estimatedPromptTokens + this.maxOutputTokens >
      this.contextWindowTokens
    ) {
      throw new ContextWindowExceeded(
        `Prompt estimado em ${estimatedPromptTokens} tokens excede a janela do modelo (${this.contextWindowTokens}).`,
      );
    }
  }
}
