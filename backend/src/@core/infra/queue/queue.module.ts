import { Global, Module } from '@nestjs/common';
import { InMemoryQueueClient } from './in-memory-queue.client';

export const JOB_QUEUE_CLIENT = 'JOB_QUEUE_CLIENT';

@Global()
@Module({
  providers: [{ provide: JOB_QUEUE_CLIENT, useClass: InMemoryQueueClient }],
  exports: [JOB_QUEUE_CLIENT],
})
export class QueueModule {}
