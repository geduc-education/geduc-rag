import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { json } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters';
import { buildValidationException } from './common/pipes';
import { TENANT_HEADER } from './common/tenancy/tenant-scoped.decorator';
import { parseCorsOrigins } from './config/cors';
import { buildSwaggerConfig } from './config/swagger.config';

/**
 * Teto do corpo JSON. Documentos não passam por aqui: o `POST /documents` é
 * multipart (limite próprio em `DOCUMENT_MAX_UPLOAD_BYTES`, no `MulterModule`).
 */
const JSON_BODY_LIMIT = '1mb';

async function bootstrap() {
  // bufferLogs: guarda os logs do boot até o Logger do nestjs-pino assumir.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  const configService = app.get(ConfigService);
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  // Atrás do Nginx (produção), `TRUST_PROXY=true` faz o Express resolver
  // `req.ip` pelo X-Forwarded-For — necessário para o rate limit por IP.
  if (configService.get<string>('TRUST_PROXY') === 'true') {
    app.set('trust proxy', 1);
  }

  app.use(json({ limit: JSON_BODY_LIMIT }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: buildValidationException,
    }),
  );

  // CSP desabilitada fora de produção para não quebrar o Swagger UI em /docs.
  app.use(helmet({ contentSecurityPolicy: isProduction ? undefined : false }));

  app.enableCors({
    origin: parseCorsOrigins(
      configService.get<string>('CORS_ORIGINS'),
      isProduction,
    ),
    allowedHeaders: ['Content-Type', 'Authorization', TENANT_HEADER],
    credentials: false,
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  if (!isProduction) {
    const document = SwaggerModule.createDocument(app, buildSwaggerConfig());
    SwaggerModule.setup('docs', app, document);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

// Fail-fast: erro de boot encerra o processo com log claro em vez de subir em
// estado degradado.
void bootstrap().catch((error: unknown) => {
  console.error('Falha no boot do backend:', error);
  process.exit(1);
});
