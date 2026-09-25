import { Injectable, Logger } from '@nestjs/common';

type JobHandler<T> = (payload: T) => Promise<void>;

/**
 * Fila fake — publica e processa no mesmo processo via `setImmediate` (não bloqueia o
 * request HTTP que enfileirou o job). Mesmo papel de um broker real (BullMQ/SQS): quem
 * publica (`documents`) e quem consome (`ingestion`) não se conhecem diretamente, só o
 * client. Trocar por um broker real não deveria exigir tocar nos use cases.
 */
@Injectable()
export class InMemoryQueueClient {
  private readonly logger = new Logger(InMemoryQueueClient.name);
  private readonly handlers = new Map<string, JobHandler<unknown>>();

  subscribe<T>(topic: string, handler: JobHandler<T>): void {
    this.handlers.set(topic, handler);
  }

  publish<T>(topic: string, payload: T): void {
    setImmediate(() => {
      const handler = this.handlers.get(topic);
      if (!handler) {
        this.logger.warn(`Nenhum handler registrado para o tópico "${topic}"`);
        return;
      }
      handler(payload).catch((error) =>
        this.logger.error(`Falha ao processar job do tópico "${topic}"`, error),
      );
    });
  }
}
