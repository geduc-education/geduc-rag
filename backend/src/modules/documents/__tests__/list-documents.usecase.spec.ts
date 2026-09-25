import { ListDocumentsUseCase } from '../application/usecase/document/list-documents.usecase';
import { IDocumentRepository } from '../application/interface/repository/document.repository.interface';
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

describe('ListDocumentsUseCase', () => {
  let repository: jest.Mocked<IDocumentRepository>;
  let sut: ListDocumentsUseCase;

  beforeEach(() => {
    repository = makeRepository();
    sut = new ListDocumentsUseCase(repository);
  });

  it('devolve a página do tenant como DocumentSummary e o total', async () => {
    const createdAt = new Date('2026-09-25T12:00:00.000Z');
    const document = DocumentEntity.create({
      documentId: 'doc-1',
      tenantId: 'tenant-1',
      filename: 'Relatório_ação.md',
      content: 'texto',
      mimeType: 'text/markdown',
      sizeBytes: 5,
      createdAt,
    });
    repository.list.mockResolvedValue({ data: [document], total: 7 });

    const result = await sut.execute({
      tenantId: 'tenant-1',
      page: 2,
      limit: 5,
    });

    expect(repository.list).toHaveBeenCalledWith('tenant-1', 2, 5);
    expect(result).toEqual({
      data: [
        {
          documentId: 'doc-1',
          filename: 'Relatório_ação.md',
          mimeType: 'text/markdown',
          sizeBytes: 5,
          status: 'pending',
          errorMessage: null,
          createdAt: '2026-09-25T12:00:00.000Z',
        },
      ],
      total: 7,
    });
  });

  it('usa page 1 e limit 20 quando não informados', async () => {
    repository.list.mockResolvedValue({ data: [], total: 0 });

    const result = await sut.execute({ tenantId: 'tenant-1' });

    expect(repository.list).toHaveBeenCalledWith('tenant-1', 1, 20);
    expect(result).toEqual({ data: [], total: 0 });
  });
});
