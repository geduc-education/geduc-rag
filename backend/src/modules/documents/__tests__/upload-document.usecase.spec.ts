import { BadRequestException } from '@nestjs/common';
import {
  UploadDocumentInput,
  UploadDocumentUseCase,
} from '../application/usecase/document/upload-document.usecase';
import { IDocumentRepository } from '../application/interface/repository/document.repository.interface';
import { IIngestionQueueGateway } from '../application/interface/gateways/ingestion-queue.gateway.interface';
import { ITextExtractorGateway } from '../application/interface/gateways/text-extractor.gateway.interface';
import { DocumentEntity } from '../domain/entities/document.entity';

function makeInput(
  overrides: Partial<UploadDocumentInput> = {},
): UploadDocumentInput {
  return {
    tenantId: 'tenant-1',
    userId: 'user-1',
    filename: 'apostila.md',
    mimeType: 'text/markdown',
    sizeBytes: 21,
    buffer: Buffer.from('conteúdo do documento'),
    ...overrides,
  };
}

function makeRepository(): jest.Mocked<IDocumentRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    save: jest.fn(),
    list: jest.fn(),
    delete: jest.fn(),
  };
}

function makeQueueGateway(): jest.Mocked<IIngestionQueueGateway> {
  return { enqueueIngestJob: jest.fn() };
}

function makeTextExtractor(): jest.Mocked<ITextExtractorGateway> {
  return { extract: jest.fn().mockResolvedValue('texto extraído') };
}

describe('UploadDocumentUseCase', () => {
  let repository: jest.Mocked<IDocumentRepository>;
  let queueGateway: jest.Mocked<IIngestionQueueGateway>;
  let textExtractor: jest.Mocked<ITextExtractorGateway>;
  let sut: UploadDocumentUseCase;

  beforeEach(() => {
    repository = makeRepository();
    queueGateway = makeQueueGateway();
    textExtractor = makeTextExtractor();
    sut = new UploadDocumentUseCase(repository, textExtractor, queueGateway);
  });

  describe('quando o arquivo é válido', () => {
    it('extrai o texto, persiste o documento pending com os metadados do arquivo e enfileira a ingestão', async () => {
      const input = makeInput();

      const result = await sut.execute(input);

      expect(result.status).toBe('pending');
      expect(textExtractor.extract).toHaveBeenCalledWith({
        filename: 'apostila.md',
        mimeType: 'text/markdown',
        buffer: input.buffer,
      });
      const created = repository.create.mock.calls[0][0];
      expect(created).toBeInstanceOf(DocumentEntity);
      expect(created).toMatchObject({
        documentId: result.documentId,
        tenantId: 'tenant-1',
        createdById: 'user-1',
        filename: 'apostila.md',
        mimeType: 'text/markdown',
        sizeBytes: 21,
        content: 'texto extraído',
        status: 'pending',
      });
      expect(queueGateway.enqueueIngestJob).toHaveBeenCalledWith(
        'tenant-1',
        result.documentId,
      );
    });
  });

  describe('quando a extração falha', () => {
    it('propaga o erro e não persiste nem enfileira nada', async () => {
      const error = new BadRequestException({
        code: 'UNSUPPORTED_DOCUMENT_TYPE',
        message: 'Tipo de documento não suportado.',
      });
      textExtractor.extract.mockRejectedValue(error);

      await expect(
        sut.execute(makeInput({ filename: 'virus.exe' })),
      ).rejects.toBe(error);
      expect(repository.create).not.toHaveBeenCalled();
      expect(queueGateway.enqueueIngestJob).not.toHaveBeenCalled();
    });
  });
});
