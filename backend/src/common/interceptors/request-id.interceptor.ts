import { randomUUID } from 'crypto';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';

/** Header de correlação por request (entrada e saída). */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Correlação por request. Expõe o id de correlação em `req.requestId` (para uso
 * pelo código da aplicação) e o ecoa no header da resposta.
 *
 * A fonte do id é, em ordem: o `req.id` que o nestjs-pino já gerou/reaproveitou
 * (via `genReqId`, que também carimba toda linha de log da request), o
 * `x-request-id` recebido (Nginx/edge), ou um UUID novo. Assim log e resposta
 * compartilham sempre o mesmo identificador.
 */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<
      Request & { requestId?: string; id?: string }
    >();
    const response = http.getResponse<Response>();

    const incoming = request.headers[REQUEST_ID_HEADER];
    const requestId =
      request.id ||
      (Array.isArray(incoming) ? incoming[0] : incoming) ||
      randomUUID();

    request.requestId = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);

    return next.handle();
  }
}
