import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DocumentController } from './controllers/document.controller';
import { DOCUMENTS_PROVIDERS } from './documents.providers';
import { GetDocumentContentUseCase } from './application/usecase/document/get-document-content.usecase';
import { UpdateDocumentStatusUseCase } from './application/usecase/document/update-document-status.usecase';

/**
 * Dono da tabela de documentos (MySQL via SQL parametrizado, ou in-memory com `RAG_STORAGE=memory`). `GetDocumentContentUseCase` e
 * `UpdateDocumentStatusUseCase` são exportados para o `ingestion` consumir via gateway
 * PRÓPRIO do `ingestion` (regra de fronteira cross-module) — este módulo nunca importa
 * nada de `ingestion`.
 */
@Module({
  imports: [
    // Upload em memória: o buffer vai direto para a extração de texto. Acima
    // do limite, o multer aborta antes do handler (→ 413 ATTACHMENT_TOO_LARGE).
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        storage: memoryStorage(),
        limits: {
          fileSize: Number(config.get<number>('DOCUMENT_MAX_UPLOAD_BYTES')),
          files: 1,
        },
      }),
    }),
  ],
  controllers: [DocumentController],
  providers: [
    ...Object.values(DOCUMENTS_PROVIDERS.REPOSITORY),
    ...Object.values(DOCUMENTS_PROVIDERS.GATEWAY),
    ...Object.values(DOCUMENTS_PROVIDERS.USE_CASES),
  ],
  exports: [GetDocumentContentUseCase, UpdateDocumentStatusUseCase],
})
export class DocumentsModule {}
