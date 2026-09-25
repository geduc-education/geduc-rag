import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Detecta o erro que o multer lança ao estourar o limite de tamanho do upload
 * (antes do handler). O pacote `multer` não traz tipos, então evitamos o
 * `instanceof MulterError` (não estreita `unknown`) e usamos duck-typing sobre
 * `Error` (name + code) — estável entre versões.
 */
function isFileSizeLimitError(exception: unknown): boolean {
  return (
    exception instanceof Error &&
    exception.name === 'MulterError' &&
    (exception as { code?: string }).code === 'LIMIT_FILE_SIZE'
  );
}

/** Forma normalizada de um erro para o corpo JSON da resposta. */
interface MappedError {
  status: number;
  message: string | string[];
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Filtro global de exceções. Normaliza HttpException e erros inesperados num
 * único contrato de resposta `{ statusCode, message, code?, details?, ... }` —
 * o mesmo que o frontend consome via AppException.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    const mapped = this.mapException(exception);
    const requestId = request.requestId;

    if (mapped.status >= 500) {
      this.logger.error(
        `${request.method} ${request.url}${requestId ? ` [${requestId}]` : ''}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(mapped.status).json({
      statusCode: mapped.status,
      message: mapped.message,
      ...(mapped.code ? { code: mapped.code } : {}),
      ...(mapped.details ? { details: mapped.details } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(requestId ? { requestId } : {}),
    });
  }

  /** Normaliza HttpException vs erro inesperado num único formato. */
  private mapException(exception: unknown): MappedError {
    // O multer aborta uploads acima do limite ANTES do handler, com um
    // MulterError (não-HttpException). Traduz para o mesmo 413 do contrato
    // de anexos (`assertAttachmentAllowed`), em vez de vazar 500.
    if (isFileSizeLimitError(exception)) {
      return {
        status: HttpStatus.PAYLOAD_TOO_LARGE,
        message: 'Arquivo excede o limite permitido.',
        code: 'ATTACHMENT_TOO_LARGE',
      };
    }

    if (!(exception instanceof HttpException)) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      };
    }

    const body = exception.getResponse();
    const structured =
      typeof body === 'object' && body !== null
        ? (body as {
            message?: string | string[];
            code?: string;
            details?: Record<string, unknown>;
          })
        : undefined;

    // Sem code default por status: o 413 do FileInterceptor ganha o code
    // ATTACHMENT_TOO_LARGE no AttachmentTooLargeInterceptor, ESCOPADO às
    // rotas de upload (AttachmentUploadEndpoint) — um 413 de outro domínio
    // sai sem esse code.
    return {
      status: exception.getStatus(),
      message: structured?.message ?? exception.message,
      code: structured?.code,
      details: structured?.details,
    };
  }
}
