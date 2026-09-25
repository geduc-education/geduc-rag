import {
  UploadDocumentInput,
  UploadDocumentUseCase,
} from '../application/usecase/document/upload-document.usecase';
import { IDocumentRepository } from '../application/interface/repository/document.repository.interface';
import { IIngestionQueueGateway } from '../application/interface/gateways/ingestion-queue.gateway.interface';

function makeInput(
  overrides: Partial<UploadDocumentInput> = {},
): UploadDocumentInput {
  return {
    tenantId: 'tenant-1',
    filename: 'apostila.pdf',
    content: 'conteúdo do documento',
    ...overrides,
  };
}

function makeRepository(): jest.Mocked<IDocumentRepository> {
  return { create: jest.fn(), findById: jest.fn(), save: jest.fn() };
}

function makeQueueGateway(): jest.Mocked<IIngestionQueueGateway> {
  return { enqueueIngestJob: jest.fn() };
}

describe('UploadDocumentUseCase', () => {
  let repository: jest.Mocked<IDocumentRepository>;
  let queueGateway: jest.Mocked<IIngestionQueueGateway>;
  let sut: UploadDocumentUseCase;

  beforeEach(() => {
    repository = makeRepository();
    queueGateway = makeQueueGateway();
    sut = new UploadDocumentUseCase(repository, queueGateway);
  });

  describe('quando o input é válido', () => {
    it('persiste o documento com status pending e enfileira a ingestão', async () => {
      const result = await sut.execute(makeInput());

      expect(result.status).toBe('pending');
      expect(repository.create).toHaveBeenCalledTimes(1);
      expect(queueGateway.enqueueIngestJob).toHaveBeenCalledWith(
        'tenant-1',
        result.documentId,
      );
    });
  });

  describe('quando o content é vazio', () => {
    it('lança BadRequest e não enfileira nada', async () => {
      await expect(sut.execute(makeInput({ content: '' }))).rejects.toThrow(
        'Campo content é obrigatório.',
      );
      expect(queueGateway.enqueueIngestJob).not.toHaveBeenCalled();
    });
  });
});
