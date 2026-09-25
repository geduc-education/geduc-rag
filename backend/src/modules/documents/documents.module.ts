import { Module } from '@nestjs/common';
import { DocumentController } from './controllers/document.controller';
import { DOCUMENTS_PROVIDERS } from './documents.providers';
import { GetDocumentContentUseCase } from './application/usecase/document/get-document-content.usecase';
import { UpdateDocumentStatusUseCase } from './application/usecase/document/update-document-status.usecase';

/**
 * Dono da tabela (in-memory, por ora) de documentos. `GetDocumentContentUseCase` e
 * `UpdateDocumentStatusUseCase` são exportados para o `ingestion` consumir via gateway
 * PRÓPRIO do `ingestion` (regra de fronteira cross-module) — este módulo nunca importa
 * nada de `ingestion`.
 */
@Module({
  controllers: [DocumentController],
  providers: [
    ...Object.values(DOCUMENTS_PROVIDERS.REPOSITORY),
    ...Object.values(DOCUMENTS_PROVIDERS.GATEWAY),
    ...Object.values(DOCUMENTS_PROVIDERS.USE_CASES),
  ],
  exports: [GetDocumentContentUseCase, UpdateDocumentStatusUseCase],
})
export class DocumentsModule {}
