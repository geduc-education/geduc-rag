import { randomUUID } from 'crypto';
import { IncomingMessage, ServerResponse } from 'http';
import { ConfigService } from '@nestjs/config';
import { Params } from 'nestjs-pino';
import { REQUEST_ID_HEADER } from '../common/interceptors/request-id.interceptor';

/** Shape mínimo do req serializado pelo pino-http. */
interface SerializedHttpRequest {
  method?: string;
  url?: string;
  remoteAddress?: string;
}

interface SerializedHttpResponse {
  statusCode?: number;
}

/** `req.user` populado pelo JwtAuthGuard nas rotas autenticadas. */
type RequestWithUser = IncomingMessage & { user?: { id?: string } };

export const LOG_LEVELS = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
] as const;

/**
 * Logs JSON estruturados via nestjs-pino.
 *
 * Uma linha por request no finish da resposta com método, rota, status,
 * `responseTime` (ms), `reqId` (correlação) e `userId` quando autenticado.
 * NUNCA loga headers, token ou body: o serializer de `req` projeta só
 * método/url/IP e `authorization`/`cookie` ficam em `redact`.
 *
 * `genReqId` reaproveita o `x-request-id` recebido (mesmo id que o
 * `RequestIdInterceptor` devolve no header da resposta) ou gera um UUID —
 * assim log e resposta compartilham o mesmo identificador de correlação.
 *
 * Pretty-print (`pino-pretty`) só fora de produção; em produção sai JSON puro.
 */
export function buildLoggerOptions(config: ConfigService): Params {
  const isProduction = config.get<string>('NODE_ENV') === 'production';
  const level =
    config.get<string>('LOG_LEVEL') ?? (isProduction ? 'info' : 'debug');

  return {
    pinoHttp: {
      level,
      genReqId: (req: IncomingMessage, res: ServerResponse): string => {
        const incoming = req.headers[REQUEST_ID_HEADER];
        const id = Array.isArray(incoming) ? incoming[0] : incoming;
        const requestId = id || randomUUID();
        res.setHeader(REQUEST_ID_HEADER, requestId);
        return requestId;
      },
      // Probes de uptime/Nginx batem em /health a cada poucos segundos —
      // fora do request log para não afogar o sinal.
      autoLogging: {
        ignore: (req: IncomingMessage) => req.url === '/health',
      },
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie'],
        censor: '[REDACTED]',
      },
      customProps: (req: IncomingMessage) => {
        const userId = (req as RequestWithUser).user?.id;
        return userId ? { userId } : {};
      },
      serializers: {
        req: (req: SerializedHttpRequest) => ({
          method: req.method,
          url: req.url,
          remoteAddress: req.remoteAddress,
        }),
        res: (res: SerializedHttpResponse) => ({
          statusCode: res.statusCode,
        }),
      },
      transport: isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l' },
          },
    },
  };
}
