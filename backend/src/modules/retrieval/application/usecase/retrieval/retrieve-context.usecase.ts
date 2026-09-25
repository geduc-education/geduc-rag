import { IQueryEmbeddingGateway } from '../../interface/gateways/query-embedding.gateway.interface';
import { SearchChunksQueryService } from '../../query-service/chunk/search-chunks.queryservice';
import { CitationVO } from '../../../domain/entities/value-objects/citation.vo';
import { IUseCase } from '../../../../../@core/shared/use-case.interface';

export interface RetrieveContextInput {
  tenantId: string;
  question: string;
}

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  content: string;
  score: number;
}

export interface RetrieveContextOutput {
  chunks: RetrievedChunk[];
  citations: CitationVO[];
}

/** Embeda a pergunta e busca os top-K chunks mais similares, já com as citações prontas. */
export class RetrieveContextUseCase implements IUseCase {
  constructor(
    private readonly queryEmbeddingGateway: IQueryEmbeddingGateway,
    private readonly searchChunksQueryService: SearchChunksQueryService,
    private readonly topK: number,
  ) {}

  async execute(input: RetrieveContextInput): Promise<RetrieveContextOutput> {
    const queryVector = await this.queryEmbeddingGateway.embedQuery(
      input.question,
    );
    const chunks = await this.searchChunksQueryService.search(
      input.tenantId,
      queryVector,
      this.topK,
    );

    const citations = chunks.map((chunk) =>
      CitationVO.create({
        documentId: chunk.documentId,
        chunkId: chunk.chunkId,
        excerpt: chunk.content,
      }),
    );

    return { chunks, citations };
  }
}
