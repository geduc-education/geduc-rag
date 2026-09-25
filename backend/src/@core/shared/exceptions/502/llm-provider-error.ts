import { HttpException, HttpStatus } from '@nestjs/common';

export default class LlmProviderError extends HttpException {
  constructor(message?: string) {
    super(message || 'LLM provider failure', HttpStatus.BAD_GATEWAY);
  }
}
