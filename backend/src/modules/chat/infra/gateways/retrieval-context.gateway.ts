import { Injectable } from '@nestjs/common';
import { RetrieveContextUseCase } from '../../../retrieval/application/usecase/retrieval/retrieve-context.usecase';
import {
  IRetrievalContextGateway,
  RetrievedContext,
} from '../../application/interface/gateways/retrieval-context.gateway.interface';

@Injectable()
export class RetrievalContextGateway implements IRetrievalContextGateway {
  constructor(private readonly retrieveContext: RetrieveContextUseCase) {}

  async retrieve(
    tenantId: string,
    question: string,
  ): Promise<RetrievedContext> {
    const { chunks, citations } = await this.retrieveContext.execute({
      tenantId,
      question,
    });

    return {
      contextChunks: chunks.map((chunk) => ({
        documentId: chunk.documentId,
        content: chunk.content,
      })),
      citations: citations.map((citation) => ({
        documentId: citation.documentId,
        chunkId: citation.chunkId,
        excerpt: citation.excerpt,
      })),
    };
  }
}
