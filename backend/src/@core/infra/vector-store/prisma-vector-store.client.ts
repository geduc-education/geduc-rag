import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import VectorStoreError from '../../shared/exceptions/502/vector-store-error';
import { decodeFloat32, encodeFloat32 } from './float32-codec';
import {
  VectorStoreClient,
  VectorStoreRecord,
  VectorStoreSearchResult,
} from './vector-store.client';

interface ChunkWithDocument {
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

/**
 * Adapter Prisma/MySQL do `VectorStoreClient`. A busca é uma varredura linear dos
 * chunks do tenant com documento `ready`, com cosseno calculado no Node; chunks de
 * dimensão diferente da consulta são descartados. O `filename` vem do join com
 * `document` (não é coluna de `document_chunk`).
 */
@Injectable()
export class PrismaVectorStoreClient implements VectorStoreClient {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(record: VectorStoreRecord): Promise<void> {
    const data = {
      chunkIndex: record.chunkIndex,
      content: record.content,
      embedding: encodeFloat32(record.vector),
      dimensions: record.vector.length,
      embeddingModel: record.embeddingModel,
    };
    await this.guard('upsert', () =>
      this.prisma.documentChunk.upsert({
        where: { id: record.chunkId },
        create: {
          id: record.chunkId,
          documentId: record.documentId,
          tenantId: record.tenantId,
          ...data,
        },
        update: data,
      }),
    );
  }

  async search(
    tenantId: string,
    queryVector: number[],
    topK: number,
  ): Promise<VectorStoreSearchResult[]> {
    const rows: ChunkWithDocument[] = await this.guard('search', () =>
      this.prisma.documentChunk.findMany({
        where: {
          tenantId,
          dimensions: queryVector.length,
          document: { status: 'ready' },
        },
        include: { document: { select: { filename: true } } },
      }),
    );
    return rows
      .filter((row) => row.dimensions === queryVector.length)
      .map((row) => this.toResult(row, queryVector))
      .filter((result) => Number.isFinite(result.score))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async deleteByDocument(tenantId: string, documentId: string): Promise<void> {
    await this.guard('deleteByDocument', () =>
      this.prisma.documentChunk.deleteMany({ where: { tenantId, documentId } }),
    );
  }

  private toResult(
    row: ChunkWithDocument,
    queryVector: number[],
  ): VectorStoreSearchResult {
    const vector = decodeFloat32(row.embedding);
    return {
      record: {
        chunkId: row.id,
        documentId: row.documentId,
        tenantId: row.tenantId,
        filename: row.document.filename,
        chunkIndex: row.chunkIndex,
        content: row.content,
        vector,
        embeddingModel: row.embeddingModel,
      },
      score: cosineSimilarity(queryVector, vector),
    };
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
