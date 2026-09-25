import { DocumentBuilder } from '@nestjs/swagger';
import { TENANT_HEADER } from '../common/tenancy/tenant-scoped.decorator';

/**
 * Config única do documento OpenAPI (Swagger UI em `/docs`, fora de produção).
 * Auth: Bearer JWT do usuário da plataforma; rotas do RAG exigem também o
 * header `tenant-id`.
 */
export function buildSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('GEDUC RAG API')
    .setDescription(
      'Plataforma de RAG (Retrieval-Augmented Generation) multi-tenant',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addGlobalParameters({
      name: TENANT_HEADER,
      in: 'header',
      required: false,
      description: 'UUID do tenant — obrigatório nas rotas do RAG.',
      schema: { type: 'string', format: 'uuid' },
    })
    .build();
}
