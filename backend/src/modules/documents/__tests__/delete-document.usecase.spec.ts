import NotFound from '../../../@core/shared/exceptions/400/not-found-error';
import { DeleteDocumentUseCase } from '../application/usecase/document/delete-document.usecase';
import { IDocumentRepository } from '../application/interface/repository/document.repository.interface';
import { IDocumentVectorsGateway } from '../application/interface/gateways/document-vectors.gateway.interface';
import { DocumentEntity } from '../domain/entities/document.entity';

function makeRepository(): jest.Mocked<IDocumentRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    save: jest.fn(),
    list: jest.fn(),
    delete: jest.fn(),
  };
}

function makeVectorsGateway(): jest.Mocked<IDocumentVectorsGateway> {
  return { deleteByDocument: jest.fn().mockResolvedValue(undefined) };
}

function makeDocument(): DocumentEntity {
  return DocumentEntity.create({
    documentId: 'doc-1',
    tenantId: 'tenant-1',
    filename: 'apostila.md',
    content: 'texto',
  });
}

describe('DeleteDocumentUseCase', () => {
  let repository: jest.Mocked<IDocumentRepository>;
  let vectorsGateway: jest.Mocked<IDocumentVectorsGateway>;
  let sut: DeleteDocumentUseCase;

  beforeEach(() => {
    repository = makeRepository();
    vectorsGateway = makeVectorsGateway();
    sut = new DeleteDocumentUseCase(repository, vectorsGateway);
  });

  it('remove os vetores do documento e depois o documento, no tenant', async () => {
    const order: string[] = [];
    repository.findById.mockResolvedValue(makeDocument());
    vectorsGateway.deleteByDocument.mockImplementation(() => {
      order.push('vectors');
      return Promise.resolve();
    });
    repository.delete.mockImplementation(() => {
      order.push('document');
      return Promise.resolve(true);
    });

    await sut.execute({ tenantId: 'tenant-1', documentId: 'doc-1' });

    expect(vectorsGateway.deleteByDocument).toHaveBeenCalledWith(
      'tenant-1',
      'doc-1',
    );
    expect(repository.delete).toHaveBeenCalledWith('tenant-1', 'doc-1');
    expect(order).toEqual(['vectors', 'document']);
  });

  it('documento inexistente no tenant → NotFound, sem tocar nos vetores', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      sut.execute({ tenantId: 'tenant-1', documentId: 'doc-x' }),
    ).rejects.toBeInstanceOf(NotFound);
    expect(vectorsGateway.deleteByDocument).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('documento removido entre a busca e a exclusão → NotFound', async () => {
    repository.findById.mockResolvedValue(makeDocument());
    repository.delete.mockResolvedValue(false);

    await expect(
      sut.execute({ tenantId: 'tenant-1', documentId: 'doc-1' }),
    ).rejects.toBeInstanceOf(NotFound);
  });
});
