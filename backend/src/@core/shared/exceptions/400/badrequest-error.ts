import { HttpException, HttpStatus } from '@nestjs/common';

export default class BadRequest extends HttpException {
  constructor(message?: string) {
    super(message || 'Bad Request', HttpStatus.BAD_REQUEST);
  }
}
