import { ConfigService } from '@nestjs/config';
import { ILlmProviderGateway } from './application/interface/gateways/llm-provider.gateway.interface';
import { LlmProviderGateway } from './infra/gateways/llm-provider.gateway';
import { OllamaLlmProviderGateway } from './infra/gateways/ollama-llm-provider.gateway';
import { PromptBuilderService } from './application/services/prompt-builder.service';
import { GenerateAnswerUseCase } from './application/usecase/generation/generate-answer.usecase';

export namespace GENERATION_PROVIDERS {
  export namespace GATEWAY {
    export const LLM_PROVIDER_GATEWAY = {
      provide: 'ILlmProviderGateway',
      useFactory: (config: ConfigService): ILlmProviderGateway => {
        if (config.get<string>('LLM_PROVIDER') !== 'ollama') {
          return new LlmProviderGateway();
        }
        return new OllamaLlmProviderGateway({
          baseUrl: config.getOrThrow<string>('LLM_BASE_URL'),
          model: config.getOrThrow<string>('LLM_MODEL'),
          timeoutMs: config.getOrThrow<number>('LLM_TIMEOUT_MS'),
          contextWindowTokens: config.getOrThrow<number>(
            'LLM_CONTEXT_WINDOW_TOKENS',
          ),
        });
      },
      inject: [ConfigService],
    };
  }

  export namespace SERVICES {
    export const PROMPT_BUILDER = {
      provide: PromptBuilderService,
      useFactory: () => new PromptBuilderService(),
      inject: [] as string[],
    };
  }

  export namespace USE_CASES {
    export const GENERATE_ANSWER = {
      provide: GenerateAnswerUseCase,
      useFactory: (
        promptBuilder: PromptBuilderService,
        llmProviderGateway: ILlmProviderGateway,
        config: ConfigService,
      ) =>
        new GenerateAnswerUseCase(
          promptBuilder,
          llmProviderGateway,
          config.get<number>('LLM_MAX_OUTPUT_TOKENS')!,
          config.get<number>('LLM_CONTEXT_WINDOW_TOKENS')!,
        ),
      inject: [
        SERVICES.PROMPT_BUILDER.provide,
        GATEWAY.LLM_PROVIDER_GATEWAY.provide,
        ConfigService,
      ],
    };
  }
}
