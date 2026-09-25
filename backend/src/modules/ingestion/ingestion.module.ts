import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { EmbeddingModule } from '../embedding/embedding.module';
import { INGESTION_PROVIDERS } from './ingestion.providers';
import { ChunkEmbeddingProcessor } from './infra/queue/chunk-embedding.processor';

/**
 * Orquestra parsing → chunking → disparo de embedding. Consome `documents` (conteúdo do
 * documento + atualização de status) e `embedding` (embed + persistência) exclusivamente
 * via gateway PRÓPRIO (regra de fronteira cross-module) — nunca chama repositório/use case
 * desses módulos diretamente fora de `infra/gateways/`.
 */
@Module({
  imports: [DocumentsModule, EmbeddingModule],
  providers: [
    ...Object.values(INGESTION_PROVIDERS.GATEWAY),
    ...Object.values(INGESTION_PROVIDERS.SERVICES),
    ...Object.values(INGESTION_PROVIDERS.USE_CASES),
    ChunkEmbeddingProcessor,
  ],
})
export class IngestionModule {}
