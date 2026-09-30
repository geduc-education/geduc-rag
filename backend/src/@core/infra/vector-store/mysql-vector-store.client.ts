import { Injectable } from '@nestjs/common';
import type { IDatabaseConnection } from '../../application/adapters/database-connection.interface';
import VectorStoreError from '../../shared/exceptions/502/vector-store-error';
import { decodeFloat32, encodeFloat32 } from './float32-codec';
import {
  VectorStoreClient,
  VectorStoreRecord,
  VectorStoreSearchResult,
} from './vector-store.client';

interface ChunkRow {
  id: string;
  document_id: string;
  tenant_id: string;
  chunk_index: number;
  content: string;
  embedding: Uint8Array;
  dimensions: number;
  embedding_model: string;
  filename: string;
}

const UPSERT_SQL = `INSERT INTO document_chunk
  (id, document_id, tenant_id, chunk_index, content, embedding, dimensions, embedding_model)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    chunk_index = VALUES(chunk_index),
    content = VALUES(content),
    embedding = VALUES(embedding),
    dimensions = VALUES(dimensions),
    embedding_model = VALUES(embedding_model)`;

const SEARCH_SQL = `SELECT c.id, c.document_id, c.tenant_id, c.chunk_index, c.content,
    c.embedding, c.dimensions, c.embedding_model, d.filename
  FROM document_chunk c
  INNER JOIN document d ON d.id = c.document_id
  WHERE c.tenant_id = ? AND c.dimensions = ? AND d.status = ?`;

const DELETE_SQL =
  'DELETE FROM document_chunk WHERE tenant_id = ? AND document_id = ?';

/**
 * Adapter MySQL do `VectorStoreClient`. A busca é uma varredura linear dos
 * chunks do tenant com documento `ready`, com cosseno calculado no Node; chunks de
 * dimensão diferente da consulta são descartados. O `filename` vem do JOIN com
 * `document` (não é coluna de `document_chunk`).
 */
@Injectable()
export class MysqlVectorStoreClient implements VectorStoreClient {
  constructor(private readonly connection: IDatabaseConnection) {}

  async upsert(record: VectorStoreRecord): Promise<void> {
    const encoded = encodeFloat32(record.vector);
    const embedding = Buffer.from(
      encoded.buffer,
      encoded.byteOffset,
      encoded.byteLength,
    );
    await this.guard('upsert', () =>
      this.connection.insert(UPSERT_SQL, [
        record.chunkId,
        record.documentId,
        record.tenantId,
        record.chunkIndex,
        record.content,
        embedding,
        record.vector.length,
        record.embeddingModel,
      ]),
    );
  }

  async search(
    tenantId: string,
    queryVector: number[],
    topK: number,
  ): Promise<VectorStoreSearchResult[]> {
    const rows = await this.guard('search', () =>
      this.connection.query<ChunkRow>(SEARCH_SQL, [
        tenantId,
        queryVector.length,
        'ready',
      ]),
    );
    return rows
      .filter((row) => row.dimensions === queryVector.length)
      .map((row) => toResult(row, queryVector))
      .filter((result) => Number.isFinite(result.score))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async deleteByDocument(tenantId: string, documentId: string): Promise<void> {
    await this.guard('deleteByDocument', () =>
      this.connection.delete(DELETE_SQL, [tenantId, documentId]),
    );
  }

  private async guard<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new VectorStoreError(`Vector store ${operation} failed: ${reason}`);
    }
  }
}

function toResult(
  row: ChunkRow,
  queryVector: number[],
): VectorStoreSearchResult {
  const vector = decodeFloat32(row.embedding);
  return {
    record: {
      chunkId: row.id,
      documentId: row.document_id,
      tenantId: row.tenant_id,
      filename: row.filename,
      chunkIndex: row.chunk_index,
      content: row.content,
      vector,
      embeddingModel: row.embedding_model,
    },
    score: cosineSimilarity(queryVector, vector),
  };
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
