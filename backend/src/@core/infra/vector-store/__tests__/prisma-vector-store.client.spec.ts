import VectorStoreError from '../../../shared/exceptions/502/vector-store-error';
import { PrismaService } from '../../../../database/prisma.service';
import { decodeFloat32, encodeFloat32 } from '../float32-codec';
import { PrismaVectorStoreClient } from '../prisma-vector-store.client';

interface ChunkRow {
  id: string;
  documentId: string;
  tenantId: string;
  chunkIndex: number;
  content: string;
  embedding: Uint8Array;
  dimensions: number;
  embeddingModel: string;
  document: { filename: string };
}

function vectorOf(dims: number, seed: number): number[] {
  return Array.from({ length: dims }, (_, i) => ((i + seed) % 7) - 3 + seed);
}

function row(id: string, vector: number[], filename = 'manual.pdf'): ChunkRow {
  return {
    id,
    documentId: 'doc-1',
    tenantId: 'tenant-a',
    chunkIndex: 0,
    content: `conteúdo ${id}`,
    embedding: encodeFloat32(vector),
    dimensions: vector.length,
    embeddingModel: 'Xenova/multilingual-e5-small',
    document: { filename },
  };
}

describe('float32-codec', () => {
  it('decodeFloat32(encodeFloat32(v)) devolve v com precisão float32', () => {
    const v = [0.1, -0.25, 3.14159, 0, 1e-3];
    const decoded = decodeFloat32(encodeFloat32(v));
    expect(decoded).toHaveLength(v.length);
    decoded.forEach((value, i) => expect(value).toBeCloseTo(v[i], 6));
  });

  it('codifica 4 bytes por dimensão', () => {
    expect(encodeFloat32(new Array<number>(384).fill(1)).byteLength).toBe(1536);
  });

  it('decodifica um Uint8Array com byteOffset diferente de zero', () => {
    const encoded = encodeFloat32([1.5, -2.5]);
    const buffer = new Uint8Array(encoded.byteLength + 4);
    buffer.set(encoded, 4);
    expect(decodeFloat32(buffer.subarray(4))).toEqual([1.5, -2.5]);
  });
});

describe('PrismaVectorStoreClient', () => {
  let findMany: jest.Mock;
  let upsert: jest.Mock;
  let deleteMany: jest.Mock;
  let client: PrismaVectorStoreClient;

  beforeEach(() => {
    findMany = jest.fn();
    upsert = jest.fn().mockResolvedValue({});
    deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const prisma = {
      documentChunk: { findMany, upsert, deleteMany },
    } as unknown as PrismaService;
    client = new PrismaVectorStoreClient(prisma);
  });

  describe('search', () => {
    it('filtra por tenantId e documento ready e inclui o filename', async () => {
      findMany.mockResolvedValue([]);
      await client.search('tenant-a', [1, 0, 0], 5);

      const args = findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
        include: unknown;
      };
      expect(args.where).toMatchObject({
        tenantId: 'tenant-a',
        document: { status: 'ready' },
      });
      expect(args.include).toEqual({
        document: { select: { filename: true } },
      });
    });

    it('ordena por cosseno desc, corta em topK e resolve filename pelo join', async () => {
      findMany.mockResolvedValue([
        row('longe', [0, 1, 0], 'b.md'),
        row('perto', [1, 0.1, 0], 'a.md'),
        row('meio', [1, 1, 0], 'c.md'),
      ]);

      const results = await client.search('tenant-a', [1, 0, 0], 2);

      expect(results.map((r) => r.record.chunkId)).toEqual(['perto', 'meio']);
      expect(results[0].record.filename).toBe('a.md');
      expect(results[0].record.tenantId).toBe('tenant-a');
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('ignora dimensão diferente sem NaN', async () => {
      findMany.mockResolvedValue([
        row('c1', vectorOf(384, 1)),
        row('c2', vectorOf(384, 2)),
        row('c3', [1, 2, 3]),
      ]);

      const results = await client.search('tenant-a', vectorOf(384, 1), 10);

      expect(results.map((r) => r.record.chunkId).sort()).toEqual(['c1', 'c2']);
      results.forEach((r) => {
        expect(Number.isFinite(r.score)).toBe(true);
        expect(r.record.vector).toHaveLength(384);
      });
    });

    it('converte erro do Prisma em VectorStoreError', async () => {
      findMany.mockRejectedValue(new Error('connection lost'));
      await expect(client.search('tenant-a', [1], 1)).rejects.toBeInstanceOf(
        VectorStoreError,
      );
    });
  });

  describe('upsert', () => {
    it('grava o embedding em Float32 com dimensions = vector.length', async () => {
      await client.upsert({
        chunkId: 'chunk-1',
        documentId: 'doc-1',
        tenantId: 'tenant-a',
        filename: 'manual.pdf',
        chunkIndex: 2,
        content: 'texto',
        vector: [0.5, -1, 2],
        embeddingModel: 'mock',
      });

      const args = upsert.mock.calls[0][0] as {
        where: { id: string };
        create: Record<string, unknown> & { embedding: Uint8Array };
        update: Record<string, unknown> & { embedding: Uint8Array };
      };
      expect(args.where).toEqual({ id: 'chunk-1' });
      expect(args.create).toMatchObject({
        id: 'chunk-1',
        documentId: 'doc-1',
        tenantId: 'tenant-a',
        chunkIndex: 2,
        content: 'texto',
        dimensions: 3,
        embeddingModel: 'mock',
      });
      expect(args.create).not.toHaveProperty('filename');
      expect(decodeFloat32(args.create.embedding)).toEqual([0.5, -1, 2]);
      expect(args.update).toMatchObject({ dimensions: 3 });
    });

    it('converte erro do Prisma em VectorStoreError', async () => {
      upsert.mockRejectedValue(new Error('fk violation'));
      await expect(
        client.upsert({
          chunkId: 'c',
          documentId: 'd',
          tenantId: 't',
          filename: 'f',
          chunkIndex: 0,
          content: 'x',
          vector: [1],
          embeddingModel: 'mock',
        }),
      ).rejects.toBeInstanceOf(VectorStoreError);
    });
  });

  describe('deleteByDocument', () => {
    it('filtra por tenantId e documentId', async () => {
      await client.deleteByDocument('tenant-a', 'doc-1');
      expect(deleteMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-a', documentId: 'doc-1' },
      });
    });

    it('converte erro do Prisma em VectorStoreError', async () => {
      deleteMany.mockRejectedValue(new Error('timeout'));
      await expect(
        client.deleteByDocument('tenant-a', 'doc-1'),
      ).rejects.toBeInstanceOf(VectorStoreError);
    });
  });
});
