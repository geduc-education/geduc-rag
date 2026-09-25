import { Module } from '@nestjs/common';
import { GENERATION_PROVIDERS } from './generation.providers';
import { GenerateAnswerUseCase } from './application/usecase/generation/generate-answer.usecase';

/** Prompt templates, chamada ao LLM e parsing de output. Exporta o use case de geração. */
@Module({
  providers: [
    ...Object.values(GENERATION_PROVIDERS.GATEWAY),
    ...Object.values(GENERATION_PROVIDERS.SERVICES),
    ...Object.values(GENERATION_PROVIDERS.USE_CASES),
  ],
  exports: [GenerateAnswerUseCase],
})
export class GenerationModule {}
