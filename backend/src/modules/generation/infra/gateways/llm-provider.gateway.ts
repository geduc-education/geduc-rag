import { Injectable } from '@nestjs/common';
import {
  ILlmProviderGateway,
  LlmGenerateInput,
  LlmGenerateOutput,
} from '../../application/interface/gateways/llm-provider.gateway.interface';

/**
 * Mock — devolve uma resposta canônica citando o contexto encontrado no prompt. Ver
 * `CLAUDE.md` ("Estado atual") — troca por gateway real (OpenAI/Anthropic) atrás da mesma
 * interface, sem tocar no use case de geração.
 */
@Injectable()
export class LlmProviderGateway implements ILlmProviderGateway {
  async generate(input: LlmGenerateInput): Promise<LlmGenerateOutput> {
    const hasContext = !input.prompt.includes(
      '(nenhum trecho relevante encontrado)',
    );
    const text = hasContext
      ? 'Com base nos trechos [1] do contexto recuperado, esta é uma resposta de exemplo (provider mock).'
      : 'Não encontrei contexto suficiente para responder com segurança (provider mock).';

    return {
      text,
      inputTokens: this.estimateTokens(input.prompt),
      outputTokens: this.estimateTokens(text),
    };
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
