import { HttpException, HttpStatus } from '@nestjs/common';

/** Prompt montado (contexto + histórico + pergunta) excede a janela do modelo. */
export default class ContextWindowExceeded extends HttpException {
  constructor(message?: string) {
    super(message || 'Context window exceeded', HttpStatus.BAD_REQUEST);
  }
}
