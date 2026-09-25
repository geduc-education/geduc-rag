import { Injectable } from '@nestjs/common';
import { GenerateAnswerUseCase } from '../../../generation/application/usecase/generation/generate-answer.usecase';
import {
  GenerateAnswerRequest,
  GeneratedAnswer,
  IAnswerGenerationGateway,
} from '../../application/interface/gateways/answer-generation.gateway.interface';

@Injectable()
export class AnswerGenerationGateway implements IAnswerGenerationGateway {
  constructor(private readonly generateAnswer: GenerateAnswerUseCase) {}

  async generate(request: GenerateAnswerRequest): Promise<GeneratedAnswer> {
    const result = await this.generateAnswer.execute(request);
    return {
      answer: result.answer,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    };
  }
}
