import { GenerateAnswerUseCase } from '../application/usecase/generation/generate-answer.usecase';
import { PromptBuilderService } from '../application/services/prompt-builder.service';
import { ILlmProviderGateway } from '../application/interface/gateways/llm-provider.gateway.interface';

function makeLlmGateway(): jest.Mocked<ILlmProviderGateway> {
  return {
    generate: jest.fn().mockResolvedValue({
      text: 'resposta',
      inputTokens: 10,
      outputTokens: 5,
    }),
  };
}

function makeInput() {
  return {
    question: 'Qual o prazo?',
    contextChunks: [{ documentId: 'doc-1', content: 'trecho' }],
    history: [],
  };
}

describe('GenerateAnswerUseCase', () => {
  let llmGateway: jest.Mocked<ILlmProviderGateway>;
  let sut: GenerateAnswerUseCase;

  beforeEach(() => {
    llmGateway = makeLlmGateway();
    sut = new GenerateAnswerUseCase(
      new PromptBuilderService(),
      llmGateway,
      100,
      1000,
    );
  });

  describe('quando o prompt cabe na janela do modelo', () => {
    it('chama o gateway e retorna a resposta com tokens e latência', async () => {
      const result = await sut.execute(makeInput());

      expect(result.answer).toBe('resposta');
      expect(result.inputTokens).toBe(10);
      expect(result.outputTokens).toBe(5);
      expect(typeof result.latencyMs).toBe('number');
    });
  });

  describe('quando o prompt excede a janela do modelo', () => {
    it('lança ContextWindowExceeded antes de chamar o gateway', async () => {
      sut = new GenerateAnswerUseCase(
        new PromptBuilderService(),
        llmGateway,
        100,
        10,
      );

      await expect(sut.execute(makeInput())).rejects.toThrow(
        /excede a janela do modelo/,
      );
      expect(llmGateway.generate).not.toHaveBeenCalled();
    });
  });
});
