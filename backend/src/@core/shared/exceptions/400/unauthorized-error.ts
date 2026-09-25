import { HttpException, HttpStatus } from '@nestjs/common';

export default class Unauthorized extends HttpException {
  constructor(message?: string) {
    super(message || 'Unauthorized', HttpStatus.UNAUTHORIZED);
  }
}
