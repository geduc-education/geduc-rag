import { IngestDocumentUseCase } from '../application/usecase/ingestion/ingest-document.usecase';
import { ChunkingService } from '../application/services/chunking.service';
import { IDocumentSourceGateway } from '../application/interface/gateways/document-source.gateway.interface';
import { IDocumentStatusGateway } from '../application/interface/gateways/document-status.gateway.interface';
import { IEmbeddingIngestGateway } from '../application/interface/gateways/embedding-ingest.gateway.interface';

function makeDocumentSourceGateway(): jest.Mocked<IDocumentSourceGateway> {
  return { getContent: jest.fn() };
}

function makeDocumentStatusGateway(): jest.Mocked<IDocumentStatusGateway> {
  return {
    markProcessing: jest.fn(),
    markReady: jest.fn(),
    markFailed: jest.fn(),
  };
}

function makeEmbeddingIngestGateway(): jest.Mocked<IEmbeddingIngestGateway> {
  return {
    embedAndStore: jest.fn().mockResolvedValue({
      embeddingModel: 'mock-model',
      embeddingVersion: 'v1',
    }),
  };
}

describe('IngestDocumentUseCase', () => {
  let documentSourceGateway: jest.Mocked<IDocumentSourceGateway>;
  let documentStatusGateway: jest.Mocked<IDocumentStatusGateway>;
  let embeddingIngestGateway: jest.Mocked<IEmbeddingIngestGateway>;
  let sut: IngestDocumentUseCase;

  beforeEach(() => {
    documentSourceGateway = makeDocumentSourceGateway();
    documentStatusGateway = makeDocumentStatusGateway();
    embeddingIngestGateway = makeEmbeddingIngestGateway();
    const chunkingService = new ChunkingService(10, 0);
    sut = new IngestDocumentUseCase(
      documentSourceGateway,
      chunkingService,
      embeddingIngestGateway,
      documentStatusGateway,
    );
  });

  describe('quando a ingestão é bem-sucedida', () => {
    it('marca processing, embeda todos os chunks e marca ready', async () => {
      documentSourceGateway.getContent.mockResolvedValue({
        filename: 'a.txt',
        content: '01234567890123456789',
      });

      await sut.execute({ tenantId: 'tenant-1', documentId: 'doc-1' });

      expect(documentStatusGateway.markProcessing).toHaveBeenCalledWith(
        'tenant-1',
        'doc-1',
      );
      expect(embeddingIngestGateway.embedAndStore).toHaveBeenCalledTimes(2);
      expect(documentStatusGateway.markReady).toHaveBeenCalledWith(
        'tenant-1',
        'doc-1',
        'mock-model',
        'v1',
      );
      expect(documentStatusGateway.markFailed).not.toHaveBeenCalled();
    });
  });

  describe('quando a leitura do documento falha', () => {
    it('marca failed e propaga o erro', async () => {
      documentSourceGateway.getContent.mockRejectedValue(
        new Error('não encontrado'),
      );

      await expect(
        sut.execute({ tenantId: 'tenant-1', documentId: 'doc-1' }),
      ).rejects.toThrow('não encontrado');
      expect(documentStatusGateway.markFailed).toHaveBeenCalledWith(
        'tenant-1',
        'doc-1',
      );
      expect(embeddingIngestGateway.embedAndStore).not.toHaveBeenCalled();
    });
  });
});
