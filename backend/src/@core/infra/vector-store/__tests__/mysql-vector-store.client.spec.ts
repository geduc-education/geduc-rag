import {
  IDatabaseConnection,
  SqlParams,
} from '../../../application/adapters/database-connection.interface';
import VectorStoreError from '../../../shared/exceptions/502/vector-store-error';
import { decodeFloat32, encodeFloat32 } from '../float32-codec';
import { MysqlVectorStoreClient } from '../mysql-vector-store.client';

interface ChunkRow {
  id: string;
  document_id: string;
  tenant_id: string;
  chunk_index: number;
  content: string;
  embedding: Buffer;
  dimensions: number;
  embedding_model: string;
  filename: string;
}

function vectorOf(dims: number, seed: number): number[] {
  return Array.from({ length: dims }, (_, i) => ((i + seed) % 7) - 3 + seed);
}

function toBuffer(vector: number[]): Buffer {
  const encoded = encodeFloat32(vector);
  return Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength);
}

function row(id: string, vector: number[], filename = 'manual.pdf'): ChunkRow {
  return {
    id,
    document_id: 'doc-1',
    tenant_id: 't1',
    chunk_index: 0,
    content: `conteúdo ${id}`,
    embedding: toBuffer(vector),
    dimensions: vector.length,
    embedding_model: 'Xenova/multilingual-e5-small',
    filename,
  };
}

function callOf(mock: jest.Mock): [string, SqlParams] {
  return (mock.mock.calls as [string, SqlParams][])[0];
}

const RECORD = {
  chunkId: 'chunk-1',
  documentId: 'doc-1',
  tenantId: 't1',
  filename: 'manual.pdf',
  chunkIndex: 2,
  content: 'texto',
  vector: [0.5, -1, 2],
  embeddingModel: 'mock',
};

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

describe('MysqlVectorStoreClient', () => {
  let query: jest.Mock;
  let insert: jest.Mock;
  let remove: jest.Mock;
  let client: MysqlVectorStoreClient;

  beforeEach(() => {
    query = jest.fn().mockResolvedValue([]);
    insert = jest.fn().mockResolvedValue({ affectedRows: 1, insertId: 0 });
    remove = jest.fn().mockResolvedValue({ affectedRows: 0, insertId: 0 });
    const connection = {
      query,
      insert,
      delete: remove,
    } as unknown as IDatabaseConnection;
    client = new MysqlVectorStoreClient(connection);
  });

  describe('search', () => {
    it('filtra por tenant, dimensão e documento ready com JOIN em document', async () => {
      const v = [1, 0, 0];
      await client.search('t1', v, 5);

      const [sql, params] = callOf(query);
      expect(sql).toContain('FROM document_chunk c');
      expect(sql).toContain('INNER JOIN document d ON d.id = c.document_id');
      expect(sql).toContain('c.tenant_id = ?');
      expect(sql).toContain('c.dimensions = ?');
      expect(sql).toContain('d.status = ?');
      expect(sql).toContain('d.filename');
      expect(params).toEqual(['t1', v.length, 'ready']);
    });

    it('devolve os topK de maior cosseno com filename do documento', async () => {
      query.mockResolvedValue([
        row('longe', [0, 1, 0], 'b.md'),
        row('perto', [1, 0.1, 0], 'a.md'),
        row('meio', [1, 1, 0], 'c.md'),
      ]);

      const results = await client.search('t1', [1, 0, 0], 2);

      expect(results.map((r) => r.record.chunkId)).toEqual(['perto', 'meio']);
      expect(results[0].record).toMatchObject({
        filename: 'a.md',
        tenantId: 't1',
        documentId: 'doc-1',
        chunkIndex: 0,
        embeddingModel: 'Xenova/multilingual-e5-small',
      });
      expect(results[0].record.vector[1]).toBeCloseTo(0.1, 6);
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('ignora dimensão diferente sem NaN', async () => {
      query.mockResolvedValue([
        row('c1', vectorOf(384, 1)),
        row('c2', vectorOf(384, 2)),
        row('c3', [1, 2, 3]),
      ]);

      const results = await client.search('t1', vectorOf(384, 1), 10);

      expect(results.map((r) => r.record.chunkId).sort()).toEqual(['c1', 'c2']);
      results.forEach((r) => {
        expect(Number.isFinite(r.score)).toBe(true);
        expect(r.record.vector).toHaveLength(384);
      });
    });

    it('converte falha de conexão em VectorStoreError', async () => {
      query.mockRejectedValue(new Error('connect ECONNREFUSED'));
      await expect(client.search('t1', [1], 1)).rejects.toBeInstanceOf(
        VectorStoreError,
      );
    });
  });

  describe('upsert', () => {
    it('faz INSERT … ON DUPLICATE KEY UPDATE com embedding em Buffer Float32', async () => {
      await client.upsert(RECORD);

      const [sql, params] = callOf(insert);
      expect(sql).toContain('INSERT INTO document_chunk');
      expect(sql).toContain('ON DUPLICATE KEY UPDATE');
      expect(sql).not.toContain('filename');
      const embedding = params.find((p) => Buffer.isBuffer(p)) as Buffer;
      expect(decodeFloat32(embedding)).toEqual([0.5, -1, 2]);
      expect(params).toEqual([
        'chunk-1',
        'doc-1',
        't1',
        2,
        'texto',
        embedding,
        3,
        'mock',
      ]);
    });

    it('converte erro do banco em VectorStoreError', async () => {
      insert.mockRejectedValue(new Error('fk violation'));
      await expect(client.upsert(RECORD)).rejects.toBeInstanceOf(
        VectorStoreError,
      );
    });
  });

  describe('deleteByDocument', () => {
    it('filtra por tenant_id e document_id', async () => {
      await client.deleteByDocument('t1', 'doc-1');
      const [sql, params] = callOf(remove);
      expect(sql).toBe(
        'DELETE FROM document_chunk WHERE tenant_id = ? AND document_id = ?',
      );
      expect(params).toEqual(['t1', 'doc-1']);
    });

    it('converte erro do banco em VectorStoreError', async () => {
      remove.mockRejectedValue(new Error('timeout'));
      await expect(
        client.deleteByDocument('t1', 'doc-1'),
      ).rejects.toBeInstanceOf(VectorStoreError);
    });
  });
});
