import { DocumentEntity } from '../domain/entities/document.entity';
import { InMemoryDocumentRepository } from '../infra/database/repositories/in-memory-document.repository';
import { toDocumentSummary } from '../application/usecase/document/document-summary';

function makeDocument(
  tenantId: string,
  documentId: string,
  createdAt: Date,
): DocumentEntity {
  return DocumentEntity.create({
    documentId,
    tenantId,
    filename: `${documentId}.md`,
    content: `conteúdo de ${documentId}`,
    createdAt,
  });
}

describe('InMemoryDocumentRepository', () => {
  let sut: InMemoryDocumentRepository;

  beforeEach(async () => {
    sut = new InMemoryDocumentRepository();
    await sut.create(makeDocument('A', 'a-1', new Date('2026-01-01')));
    await sut.create(makeDocument('A', 'a-2', new Date('2026-01-03')));
    await sut.create(makeDocument('A', 'a-3', new Date('2026-01-02')));
    await sut.create(makeDocument('B', 'b-1', new Date('2026-01-04')));
  });

  describe('list', () => {
    it('devolve só documentos do tenant, ordenados por createdAt desc', async () => {
      const result = await sut.list('A', 1, 20);
      expect(result.total).toBe(3);
      expect(result.data.map((d) => d.documentId)).toEqual([
        'a-2',
        'a-3',
        'a-1',
      ]);
    });

    it('pagina com total do tenant', async () => {
      const result = await sut.list('A', 2, 1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].documentId).toBe('a-3');
      expect(result.total).toBe(3);
    });

    it('não devolve documentos do tenant A para o tenant B', async () => {
      const result = await sut.list('B', 1, 20);
      expect(result.total).toBe(1);
      expect(result.data.map((d) => d.documentId)).toEqual(['b-1']);
    });
  });

  describe('delete', () => {
    it('devolve false para id de outro tenant e preserva o documento', async () => {
      await expect(sut.delete('B', 'a-1')).resolves.toBe(false);
      await expect(sut.findById('A', 'a-1')).resolves.not.toBeNull();
    });

    it('remove o documento do tenant e devolve true', async () => {
      await expect(sut.delete('A', 'a-1')).resolves.toBe(true);
      await expect(sut.findById('A', 'a-1')).resolves.toBeNull();
    });
  });
});

describe('toDocumentSummary', () => {
  it('mapeia a entidade com createdAt em ISO 8601', () => {
    const entity = DocumentEntity.create({
      documentId: 'doc-1',
      tenantId: 'A',
      filename: 'apostila.pdf',
      content: 'texto',
      mimeType: 'application/pdf',
      sizeBytes: 10,
      createdAt: new Date('2026-09-25T12:00:00.000Z'),
    });
    entity.markFailed('sem texto');

    expect(toDocumentSummary(entity)).toEqual({
      documentId: 'doc-1',
      filename: 'apostila.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
      status: 'failed',
      errorMessage: 'sem texto',
      createdAt: '2026-09-25T12:00:00.000Z',
    });
  });
});
