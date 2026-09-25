import { Inject, Injectable } from '@nestjs/common';
import { JOB_QUEUE_CLIENT } from '../../../../@core/infra/queue/queue.module';
import { InMemoryQueueClient } from '../../../../@core/infra/queue/in-memory-queue.client';
import {
  INGEST_DOCUMENT_TOPIC,
  IngestDocumentJob,
} from '../../../../@core/infra/queue/topics';
import { IIngestionQueueGateway } from '../../application/interface/gateways/ingestion-queue.gateway.interface';

@Injectable()
export class IngestionQueueGateway implements IIngestionQueueGateway {
  constructor(
    @Inject(JOB_QUEUE_CLIENT) private readonly queue: InMemoryQueueClient,
  ) {}

  enqueueIngestJob(tenantId: string, documentId: string): void {
    this.queue.publish<IngestDocumentJob>(INGEST_DOCUMENT_TOPIC, {
      tenantId,
      documentId,
    });
  }
}
