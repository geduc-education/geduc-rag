import { ConfigService } from '@nestjs/config';
import { GetDocumentContentUseCase } from '../documents/application/usecase/document/get-document-content.usecase';
import { UpdateDocumentStatusUseCase } from '../documents/application/usecase/document/update-document-status.usecase';
import { EmbedAndStoreChunkUseCase } from '../embedding/application/usecase/embedding/embed-and-store-chunk.usecase';
import { DocumentSourceGateway } from './infra/gateways/document-source.gateway';
import { DocumentStatusGateway } from './infra/gateways/document-status.gateway';
import { EmbeddingIngestGateway } from './infra/gateways/embedding-ingest.gateway';
import { IDocumentSourceGateway } from './application/interface/gateways/document-source.gateway.interface';
import { IDocumentStatusGateway } from './application/interface/gateways/document-status.gateway.interface';
import { IEmbeddingIngestGateway } from './application/interface/gateways/embedding-ingest.gateway.interface';
import { ChunkingService } from './application/services/chunking.service';
import { IngestDocumentUseCase } from './application/usecase/ingestion/ingest-document.usecase';

export namespace INGESTION_PROVIDERS {
  export namespace GATEWAY {
    export const DOCUMENT_SOURCE_GATEWAY = {
      provide: 'IDocumentSourceGateway',
      useFactory: (useCase: GetDocumentContentUseCase) =>
        new DocumentSourceGateway(useCase),
      inject: [GetDocumentContentUseCase],
    };

    export const DOCUMENT_STATUS_GATEWAY = {
      provide: 'IDocumentStatusGateway',
      useFactory: (useCase: UpdateDocumentStatusUseCase) =>
        new DocumentStatusGateway(useCase),
      inject: [UpdateDocumentStatusUseCase],
    };

    export const EMBEDDING_INGEST_GATEWAY = {
      provide: 'IEmbeddingIngestGateway',
      useFactory: (useCase: EmbedAndStoreChunkUseCase) =>
        new EmbeddingIngestGateway(useCase),
      inject: [EmbedAndStoreChunkUseCase],
    };
  }

  export namespace SERVICES {
    export const CHUNKING_SERVICE = {
      provide: ChunkingService,
      useFactory: (config: ConfigService) =>
        new ChunkingService(
          config.get<number>('CHUNK_SIZE')!,
          config.get<number>('CHUNK_OVERLAP')!,
        ),
      inject: [ConfigService],
    };
  }

  export namespace USE_CASES {
    export const INGEST_DOCUMENT = {
      provide: IngestDocumentUseCase,
      useFactory: (
        documentSourceGateway: IDocumentSourceGateway,
        chunkingService: ChunkingService,
        embeddingIngestGateway: IEmbeddingIngestGateway,
        documentStatusGateway: IDocumentStatusGateway,
      ) =>
        new IngestDocumentUseCase(
          documentSourceGateway,
          chunkingService,
          embeddingIngestGateway,
          documentStatusGateway,
        ),
      inject: [
        GATEWAY.DOCUMENT_SOURCE_GATEWAY.provide,
        SERVICES.CHUNKING_SERVICE.provide,
        GATEWAY.EMBEDDING_INGEST_GATEWAY.provide,
        GATEWAY.DOCUMENT_STATUS_GATEWAY.provide,
      ],
    };
  }
}
