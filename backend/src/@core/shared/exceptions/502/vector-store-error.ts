import { HttpException, HttpStatus } from '@nestjs/common';

export default class VectorStoreError extends HttpException {
  constructor(message?: string) {
    super(message || 'Vector store failure', HttpStatus.BAD_GATEWAY);
  }
}
