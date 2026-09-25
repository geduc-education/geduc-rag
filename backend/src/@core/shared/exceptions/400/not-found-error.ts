import { HttpException, HttpStatus } from '@nestjs/common';

export default class NotFound extends HttpException {
  constructor(message?: string) {
    super(message || 'Register not found', HttpStatus.NOT_FOUND);
  }
}
