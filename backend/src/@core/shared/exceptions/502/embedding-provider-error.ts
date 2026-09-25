import { HttpException, HttpStatus } from '@nestjs/common';

export default class EmbeddingProviderError extends HttpException {
  constructor(message?: string) {
    super(message || 'Embedding provider failure', HttpStatus.BAD_GATEWAY);
  }
}
