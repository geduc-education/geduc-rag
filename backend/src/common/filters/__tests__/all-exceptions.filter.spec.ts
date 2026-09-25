import {
  ArgumentsHost,
  ConflictException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { AllExceptionsFilter } from '../all-exceptions.filter';

/** Corpo capturado do `response.json(...)`. */
interface ResponseBody {
  statusCode: number;
  message: string | string[];
  code?: string;
}

/**
 * Réplica tipada do `MulterError` (o pacote `multer` não traz tipos): estende
 * `Error`, `name = 'MulterError'` e carrega `code` — igual ao objeto que o
 * multer lança ao estourar o limite de tamanho.
 */
class FakeMulterError extends Error {
  constructor(readonly code: string) {
    super('File too large');
    this.name = 'MulterError';
  }
}

/** Monta um ArgumentsHost falso capturando status/json da resposta. */
function makeHost(): {
  host: ArgumentsHost;
  status: jest.Mock;
  json: jest.Mock<void, [ResponseBody]>;
} {
  const json = jest.fn<void, [ResponseBody]>();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };
  const request = { method: 'POST', url: '/chat/attachments' };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  it('MulterError LIMIT_FILE_SIZE → 413 ATTACHMENT_TOO_LARGE', () => {
    const { host, status, json } = makeHost();

    filter.catch(new FakeMulterError('LIMIT_FILE_SIZE'), host);

    expect(status).toHaveBeenCalledWith(413);
    const body = json.mock.calls[0][0];
    expect(body.statusCode).toBe(413);
    expect(body.code).toBe('ATTACHMENT_TOO_LARGE');
    expect(typeof body.message).toBe('string');
  });

  it('413 genérico (fora das rotas de upload) NÃO recebe ATTACHMENT_TOO_LARGE', () => {
    // O code do contrato de anexos é injetado pelo AttachmentTooLargeInterceptor,
    // ESCOPADO às rotas de upload — o filtro global não mapeia 413 por status.
    const { host, status, json } = makeHost();

    filter.catch(new PayloadTooLargeException(), host);

    expect(status).toHaveBeenCalledWith(413);
    expect(json.mock.calls[0][0].code).toBeUndefined();
  });

  it('413 estruturado preserva o code original (não sobrescreve)', () => {
    const { host, json } = makeHost();

    filter.catch(
      new PayloadTooLargeException({ code: 'OUTRO_CODE', message: 'x' }),
      host,
    );

    expect(json.mock.calls[0][0].code).toBe('OUTRO_CODE');
  });

  it('preserva code de HttpException estruturada', () => {
    const { host, status, json } = makeHost();

    filter.catch(
      new ConflictException({ code: 'CONVERSATION_CLOSED', message: 'x' }),
      host,
    );

    expect(status).toHaveBeenCalledWith(409);
    const body = json.mock.calls[0][0];
    expect(body.code).toBe('CONVERSATION_CLOSED');
  });

  it('erro inesperado → 500 sem code', () => {
    const { host, status, json } = makeHost();

    filter.catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0];
    expect(body.code).toBeUndefined();
  });
});
