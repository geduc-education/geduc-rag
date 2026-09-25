import { IDocumentRepository } from './application/interface/repository/document.repository.interface';
import { IIngestionQueueGateway } from './application/interface/gateways/ingestion-queue.gateway.interface';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { InMemoryDocumentRepository } from './infra/database/repositories/in-memory-document.repository';
import { PrismaDocumentRepository } from './infra/database/repositories/prisma-document.repository';
import { IngestionQueueGateway } from './infra/gateways/ingestion-queue.gateway';
import { UploadDocumentUseCase } from './application/usecase/document/upload-document.usecase';
import { GetDocumentStatusUseCase } from './application/usecase/document/get-document-status.usecase';
import { GetDocumentContentUseCase } from './application/usecase/document/get-document-content.usecase';
import { UpdateDocumentStatusUseCase } from './application/usecase/document/update-document-status.usecase';

export namespace DOCUMENTS_PROVIDERS {
  export namespace REPOSITORY {
    /** `RAG_STORAGE=memory` mantém o adapter in-memory (e2e e dev sem banco). */
    export const DOCUMENT_REPOSITORY = {
      provide: 'IDocumentRepository',
      useFactory: (
        config: ConfigService,
        prisma: PrismaService,
      ): IDocumentRepository =>
        config.get<string>('RAG_STORAGE') === 'memory'
          ? new InMemoryDocumentRepository()
          : new PrismaDocumentRepository(prisma),
      inject: [ConfigService, PrismaService],
    };
  }

  export namespace GATEWAY {
    export const INGESTION_QUEUE_GATEWAY = {
      provide: 'IIngestionQueueGateway',
      useClass: IngestionQueueGateway,
    };
  }

  export namespace USE_CASES {
    export const UPLOAD_DOCUMENT = {
      provide: UploadDocumentUseCase,
      useFactory: (
        repository: IDocumentRepository,
        queueGateway: IIngestionQueueGateway,
      ) => new UploadDocumentUseCase(repository, queueGateway),
      inject: [
        REPOSITORY.DOCUMENT_REPOSITORY.provide,
        GATEWAY.INGESTION_QUEUE_GATEWAY.provide,
      ],
    };

    export const GET_DOCUMENT_STATUS = {
      provide: GetDocumentStatusUseCase,
      useFactory: (repository: IDocumentRepository) =>
        new GetDocumentStatusUseCase(repository),
      inject: [REPOSITORY.DOCUMENT_REPOSITORY.provide],
    };

    export const GET_DOCUMENT_CONTENT = {
      provide: GetDocumentContentUseCase,
      useFactory: (repository: IDocumentRepository) =>
        new GetDocumentContentUseCase(repository),
      inject: [REPOSITORY.DOCUMENT_REPOSITORY.provide],
    };

    export const UPDATE_DOCUMENT_STATUS = {
      provide: UpdateDocumentStatusUseCase,
      useFactory: (repository: IDocumentRepository) =>
        new UpdateDocumentStatusUseCase(repository),
      inject: [REPOSITORY.DOCUMENT_REPOSITORY.provide],
    };
  }
}
