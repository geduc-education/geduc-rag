import { Document as PrismaDocument } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { DocumentEntity } from '../domain/entities/document.entity';
import { PrismaDocumentRepository } from '../infra/database/repositories/prisma-document.repository';

type DocumentDelegateMock = {
  create: jest.Mock;
  findFirst: jest.Mock;
  updateMany: jest.Mock;
  findMany: jest.Mock;
  count: jest.Mock;
  deleteMany: jest.Mock;
};

function makePrisma(): {
  prisma: PrismaService;
  document: DocumentDelegateMock;
  transaction: jest.Mock;
} {
  const document: DocumentDelegateMock = {
    create: jest.fn().mockResolvedValue(undefined),
    findFirst: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    findMany: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
  };
  const transaction = jest.fn((operations: Promise<unknown>[]) =>
    Promise.all(operations),
  );
  const prisma = {
    document,
    $transaction: transaction,
  } as unknown as PrismaService;
  return { prisma, document, transaction };
}

function makeRow(overrides: Partial<PrismaDocument> = {}): PrismaDocument {
  return {
    id: 'doc-1',
    tenantId: 'tenant-1',
    filename: 'manual.md',
    mimeType: 'text/markdown',
    sizeBytes: 42,
    content: 'conteúdo do manual',
    status: 'failed',
    errorMessage: 'embedding indisponível',
    embeddingModel: null,
    embeddingVersion: null,
    createdById: 'user-1',
    createdAt: new Date('2026-09-01T10:00:00Z'),
    updatedAt: new Date('2026-09-01T10:05:00Z'),
    ...overrides,
  };
}

/** Todas as chamadas do mock que recebem `where` precisam filtrar por tenant. */
function expectEveryWhereHasTenant(mock: jest.Mock, tenantId: string): void {
  expect(mock).toHaveBeenCalled();
  for (const [args] of mock.mock.calls as [
    { where: Record<string, unknown> },
  ][]) {
    expect(args.where).toEqual(expect.objectContaining({ tenantId }));
  }
}

describe('PrismaDocumentRepository', () => {
  let prismaMock: ReturnType<typeof makePrisma>;
  let sut: PrismaDocumentRepository;

  beforeEach(() => {
    prismaMock = makePrisma();
    sut = new PrismaDocumentRepository(prismaMock.prisma);
  });

  describe('findById', () => {
    it('filtra por tenantId e mapeia a linha para DocumentEntity', async () => {
      prismaMock.document.findFirst.mockResolvedValue(makeRow());

      const result = await sut.findById('tenant-1', 'doc-1');

      expectEveryWhereHasTenant(prismaMock.document.findFirst, 'tenant-1');
      expect(prismaMock.document.findFirst).toHaveBeenCalledWith({
        where: { id: 'doc-1', tenantId: 'tenant-1' },
      });
      expect(result).toBeInstanceOf(DocumentEntity);
      expect(result).toMatchObject({
        documentId: 'doc-1',
        tenantId: 'tenant-1',
        filename: 'manual.md',
        mimeType: 'text/markdown',
        sizeBytes: 42,
        content: 'conteúdo do manual',
        status: 'failed',
        errorMessage: 'embedding indisponível',
        embeddingModel: null,
        createdById: 'user-1',
        createdAt: new Date('2026-09-01T10:00:00Z'),
      });
    });

    it('devolve null quando o documento não existe no tenant', async () => {
      prismaMock.document.findFirst.mockResolvedValue(null);

      await expect(sut.findById('tenant-2', 'doc-1')).resolves.toBeNull();
      expectEveryWhereHasTenant(prismaMock.document.findFirst, 'tenant-2');
    });
  });

  describe('create', () => {
    it('grava todos os campos da entidade', async () => {
      const document = DocumentEntity.create({
        documentId: 'doc-9',
        tenantId: 'tenant-1',
        filename: 'a.txt',
        content: 'abc',
        mimeType: 'text/plain',
        createdById: 'user-1',
        createdAt: new Date('2026-09-02T00:00:00Z'),
      });

      await sut.create(document);

      expect(prismaMock.document.create).toHaveBeenCalledWith({
        data: {
          id: 'doc-9',
          tenantId: 'tenant-1',
          filename: 'a.txt',
          mimeType: 'text/plain',
          sizeBytes: 3,
          content: 'abc',
          status: 'pending',
          errorMessage: null,
          embeddingModel: null,
          embeddingVersion: null,
          createdById: 'user-1',
          createdAt: new Date('2026-09-02T00:00:00Z'),
        },
      });
    });
  });

  describe('save', () => {
    it('atualiza status e motivo filtrando por tenantId', async () => {
      const document = DocumentEntity.create({
        documentId: 'doc-1',
        tenantId: 'tenant-1',
        filename: 'a.txt',
        content: 'abc',
      });
      document.markFailed('timeout do embedding');

      await sut.save(document);

      expectEveryWhereHasTenant(prismaMock.document.updateMany, 'tenant-1');
      expect(prismaMock.document.updateMany).toHaveBeenCalledWith({
        where: { id: 'doc-1', tenantId: 'tenant-1' },
        data: {
          status: 'failed',
          errorMessage: 'timeout do embedding',
          embeddingModel: null,
          embeddingVersion: null,
        },
      });
    });
  });

  describe('list', () => {
    it('pagina com $transaction([findMany, count]) filtrando por tenantId', async () => {
      prismaMock.document.findMany.mockResolvedValue([
        makeRow({ id: 'doc-2', status: 'ready', errorMessage: null }),
      ]);
      prismaMock.document.count.mockResolvedValue(11);

      const result = await sut.list('tenant-1', 2, 10);

      expect(prismaMock.transaction).toHaveBeenCalledTimes(1);
      expect(prismaMock.document.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 10,
      });
      expectEveryWhereHasTenant(prismaMock.document.findMany, 'tenant-1');
      expectEveryWhereHasTenant(prismaMock.document.count, 'tenant-1');
      expect(result.total).toBe(11);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toBeInstanceOf(DocumentEntity);
      expect(result.data[0]).toMatchObject({
        documentId: 'doc-2',
        status: 'ready',
      });
    });
  });

  describe('delete', () => {
    it('remove com deleteMany por id e tenantId e devolve true', async () => {
      prismaMock.document.deleteMany.mockResolvedValue({ count: 1 });

      await expect(sut.delete('tenant-1', 'doc-1')).resolves.toBe(true);
      expect(prismaMock.document.deleteMany).toHaveBeenCalledWith({
        where: { id: 'doc-1', tenantId: 'tenant-1' },
      });
    });

    it('devolve false quando o documento não pertence ao tenant', async () => {
      prismaMock.document.deleteMany.mockResolvedValue({ count: 0 });

      await expect(sut.delete('tenant-2', 'doc-1')).resolves.toBe(false);
      expectEveryWhereHasTenant(prismaMock.document.deleteMany, 'tenant-2');
    });
  });
});
