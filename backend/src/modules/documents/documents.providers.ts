import { IDocumentRepository } from './application/interface/repository/document.repository.interface';
import { IIngestionQueueGateway } from './application/interface/gateways/ingestion-queue.gateway.interface';
import {
  ITextExtractorGateway,
  TEXT_EXTRACTOR_GATEWAY,
} from './application/interface/gateways/text-extractor.gateway.interface';
import {
  DOCUMENT_VECTORS_GATEWAY,
  IDocumentVectorsGateway,
} from './application/interface/gateways/document-vectors.gateway.interface';
import { ConfigService } from '@nestjs/config';
import {
  DATABASE_CONNECTION,
  IDatabaseConnection,
} from '../../@core/application/adapters/database-connection.interface';
import { InMemoryDocumentRepository } from './infra/database/repositories/in-memory-document.repository';
import { DocumentRepository } from './infra/database/repositories/document.repository';
import { IngestionQueueGateway } from './infra/gateways/ingestion-queue.gateway';
import { TextExtractorGateway } from './infra/gateways/text-extractor.gateway';
import { DocumentVectorsGateway } from './infra/gateways/document-vectors.gateway';
import { UploadDocumentUseCase } from './application/usecase/document/upload-document.usecase';
import { GetDocumentStatusUseCase } from './application/usecase/document/get-document-status.usecase';
import { GetDocumentContentUseCase } from './application/usecase/document/get-document-content.usecase';
import { UpdateDocumentStatusUseCase } from './application/usecase/document/update-document-status.usecase';
import { ListDocumentsUseCase } from './application/usecase/document/list-documents.usecase';
import { DeleteDocumentUseCase } from './application/usecase/document/delete-document.usecase';

export namespace DOCUMENTS_PROVIDERS {
  export namespace REPOSITORY {
    /** `RAG_STORAGE=memory` mantém o adapter in-memory (e2e e dev sem banco). */
    export const DOCUMENT_REPOSITORY = {
      provide: 'IDocumentRepository',
      useFactory: (
        config: ConfigService,
        connection: IDatabaseConnection,
      ): IDocumentRepository =>
        config.get<string>('RAG_STORAGE') === 'memory'
          ? new InMemoryDocumentRepository()
          : new DocumentRepository(connection),
      inject: [ConfigService, DATABASE_CONNECTION],
    };
  }

  export namespace GATEWAY {
    export const INGESTION_QUEUE_GATEWAY = {
      provide: 'IIngestionQueueGateway',
      useClass: IngestionQueueGateway,
    };

    export const TEXT_EXTRACTOR = {
      provide: TEXT_EXTRACTOR_GATEWAY,
      useClass: TextExtractorGateway,
    };

    export const DOCUMENT_VECTORS = {
      provide: DOCUMENT_VECTORS_GATEWAY,
      useClass: DocumentVectorsGateway,
    };
  }

  export namespace USE_CASES {
    export const UPLOAD_DOCUMENT = {
      provide: UploadDocumentUseCase,
      useFactory: (
        repository: IDocumentRepository,
        textExtractor: ITextExtractorGateway,
        queueGateway: IIngestionQueueGateway,
      ) => new UploadDocumentUseCase(repository, textExtractor, queueGateway),
      inject: [
        REPOSITORY.DOCUMENT_REPOSITORY.provide,
        GATEWAY.TEXT_EXTRACTOR.provide,
        GATEWAY.INGESTION_QUEUE_GATEWAY.provide,
      ],
    };

    export const LIST_DOCUMENTS = {
      provide: ListDocumentsUseCase,
      useFactory: (repository: IDocumentRepository) =>
        new ListDocumentsUseCase(repository),
      inject: [REPOSITORY.DOCUMENT_REPOSITORY.provide],
    };

    export const DELETE_DOCUMENT = {
      provide: DeleteDocumentUseCase,
      useFactory: (
        repository: IDocumentRepository,
        vectorsGateway: IDocumentVectorsGateway,
      ) => new DeleteDocumentUseCase(repository, vectorsGateway),
      inject: [
        REPOSITORY.DOCUMENT_REPOSITORY.provide,
        GATEWAY.DOCUMENT_VECTORS.provide,
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
