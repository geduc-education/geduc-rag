import { RetrieveContextUseCase } from '../application/usecase/retrieval/retrieve-context.usecase';
import { SearchChunksQueryService } from '../application/query-service/chunk/search-chunks.queryservice';
import { IQueryEmbeddingGateway } from '../application/interface/gateways/query-embedding.gateway.interface';
import { IVectorSearchGateway } from '../application/interface/gateways/vector-search.gateway.interface';
import { QueryEmbeddingGateway } from '../infra/gateways/query-embedding.gateway';
import { EmbedTextUseCase } from '../../embedding/application/usecase/embedding/embed-text.usecase';

function makeQueryEmbeddingGateway(): jest.Mocked<IQueryEmbeddingGateway> {
  return { embedQuery: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]) };
}

function makeVectorSearchGateway(): jest.Mocked<IVectorSearchGateway> {
  return {
    searchSimilar: jest.fn().mockResolvedValue([
      {
        chunkId: 'doc-1:0',
        documentId: 'doc-1',
        filename: 'regimento.pdf',
        content: 'trecho relevante',
        score: 0.9,
      },
    ]),
  };
}

describe('RetrieveContextUseCase', () => {
  let queryEmbeddingGateway: jest.Mocked<IQueryEmbeddingGateway>;
  let vectorSearchGateway: jest.Mocked<IVectorSearchGateway>;
  let sut: RetrieveContextUseCase;

  beforeEach(() => {
    queryEmbeddingGateway = makeQueryEmbeddingGateway();
    vectorSearchGateway = makeVectorSearchGateway();
    const searchChunks = new SearchChunksQueryService(vectorSearchGateway);
    sut = new RetrieveContextUseCase(queryEmbeddingGateway, searchChunks, 5);
  });

  describe('quando a busca retorna chunks relevantes', () => {
    it('embeda a pergunta, busca top-K e monta as citações', async () => {
      const result = await sut.execute({
        tenantId: 'tenant-1',
        question: 'Qual o prazo?',
      });

      expect(queryEmbeddingGateway.embedQuery).toHaveBeenCalledWith(
        'Qual o prazo?',
      );
      expect(vectorSearchGateway.searchSimilar).toHaveBeenCalledWith(
        'tenant-1',
        [0.1, 0.2, 0.3],
        5,
      );
      expect(result.chunks).toHaveLength(1);
      expect(result.citations[0]).toMatchObject({
        documentId: 'doc-1',
        chunkId: 'doc-1:0',
        filename: 'regimento.pdf',
        excerpt: 'trecho relevante',
      });
      expect(result.chunks[0].filename).toBe('regimento.pdf');
    });
  });

  describe('quando a busca não retorna chunks relevantes', () => {
    it('retorna listas vazias sem lançar erro', async () => {
      vectorSearchGateway.searchSimilar.mockResolvedValue([]);

      const result = await sut.execute({
        tenantId: 'tenant-1',
        question: 'Qualquer coisa',
      });

      expect(result.chunks).toEqual([]);
      expect(result.citations).toEqual([]);
    });
  });
});

describe('QueryEmbeddingGateway', () => {
  it('embeda a pergunta com kind query', async () => {
    const embedText = {
      execute: jest.fn().mockResolvedValue([0.1, 0.2]),
    } as unknown as jest.Mocked<EmbedTextUseCase>;
    const sut = new QueryEmbeddingGateway(embedText);

    const vector = await sut.embedQuery('Qual o prazo?');

    expect(vector).toEqual([0.1, 0.2]);
    expect(embedText.execute).toHaveBeenCalledWith('Qual o prazo?', 'query');
  });
});
