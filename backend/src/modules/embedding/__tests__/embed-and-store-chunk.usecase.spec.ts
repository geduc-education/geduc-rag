import { EmbedTextUseCase } from '../application/usecase/embedding/embed-text.usecase';
import { EmbedAndStoreChunkUseCase } from '../application/usecase/embedding/embed-and-store-chunk.usecase';
import { IEmbeddingProviderGateway } from '../application/interface/gateways/embedding-provider.gateway.interface';
import { IVectorStoreGateway } from '../application/interface/gateways/vector-store.gateway.interface';

function makeEmbeddingGateway(
  dimensions: number,
): jest.Mocked<IEmbeddingProviderGateway> {
  return { embed: jest.fn().mockResolvedValue(Array(dimensions).fill(0.5)) };
}

function makeVectorStoreGateway(): jest.Mocked<IVectorStoreGateway> {
  return { upsertChunk: jest.fn() };
}

describe('EmbedAndStoreChunkUseCase', () => {
  const dimensions = 4;
  let embeddingGateway: jest.Mocked<IEmbeddingProviderGateway>;
  let vectorStoreGateway: jest.Mocked<IVectorStoreGateway>;
  let sut: EmbedAndStoreChunkUseCase;

  beforeEach(() => {
    embeddingGateway = makeEmbeddingGateway(dimensions);
    vectorStoreGateway = makeVectorStoreGateway();
    const embedText = new EmbedTextUseCase(embeddingGateway, dimensions);
    sut = new EmbedAndStoreChunkUseCase(
      embedText,
      vectorStoreGateway,
      'mock-model',
      'v1',
    );
  });

  describe('quando o provider retorna um vetor com a dimensão esperada', () => {
    it('embeda o conteúdo e persiste o chunk no vector store', async () => {
      const result = await sut.execute({
        chunkId: 'chunk-1',
        documentId: 'doc-1',
        tenantId: 'tenant-1',
        filename: 'manual.pdf',
        chunkIndex: 3,
        content: 'trecho do documento',
      });

      expect(result).toEqual({
        embeddingModel: 'mock-model',
        embeddingVersion: 'v1',
      });
      expect(embeddingGateway.embed).toHaveBeenCalledWith(
        'trecho do documento',
        'passage',
      );
      expect(vectorStoreGateway.upsertChunk).toHaveBeenCalledWith({
        chunkId: 'chunk-1',
        documentId: 'doc-1',
        tenantId: 'tenant-1',
        filename: 'manual.pdf',
        chunkIndex: 3,
        content: 'trecho do documento',
        vector: Array(dimensions).fill(0.5),
        embeddingModel: 'mock-model',
      });
    });
  });

  describe('quando o provider retorna um vetor com dimensão errada', () => {
    it('propaga o erro e não persiste nada', async () => {
      embeddingGateway.embed.mockResolvedValue([0.1, 0.2]);

      await expect(
        sut.execute({
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          tenantId: 'tenant-1',
          filename: 'manual.pdf',
          chunkIndex: 0,
          content: 'trecho',
        }),
      ).rejects.toThrow();
      expect(vectorStoreGateway.upsertChunk).not.toHaveBeenCalled();
    });
  });
});
