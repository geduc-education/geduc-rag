import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JOB_QUEUE_CLIENT } from '../../../../@core/infra/queue/queue.module';
import { InMemoryQueueClient } from '../../../../@core/infra/queue/in-memory-queue.client';
import {
  INGEST_DOCUMENT_TOPIC,
  IngestDocumentJob,
} from '../../../../@core/infra/queue/topics';
import { IngestDocumentUseCase } from '../../application/usecase/ingestion/ingest-document.usecase';

/** Assina o tópico de ingestão no boot e delega cada job ao use case de orquestração. */
@Injectable()
export class ChunkEmbeddingProcessor implements OnModuleInit {
  private readonly logger = new Logger(ChunkEmbeddingProcessor.name);

  constructor(
    @Inject(JOB_QUEUE_CLIENT) private readonly queue: InMemoryQueueClient,
    private readonly ingestDocument: IngestDocumentUseCase,
  ) {}

  onModuleInit(): void {
    this.queue.subscribe<IngestDocumentJob>(
      INGEST_DOCUMENT_TOPIC,
      async (job) => {
        this.logger.log(`Processando ingestão do documento ${job.documentId}`);
        await this.ingestDocument.execute(job);
      },
    );
  }
}
