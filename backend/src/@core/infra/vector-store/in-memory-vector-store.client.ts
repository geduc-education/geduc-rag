import { Injectable } from '@nestjs/common';
import {
  VectorStoreClient,
  VectorStoreRecord,
  VectorStoreSearchResult,
} from './vector-store.client';

/**
 * Adapter in-memory do `VectorStoreClient` — usado no e2e e em dev sem banco. Busca por
 * cosseno com varredura linear, sempre filtrada por tenant.
 */
@Injectable()
export class InMemoryVectorStoreClient implements VectorStoreClient {
  private readonly records = new Map<string, VectorStoreRecord>();

  upsert(record: VectorStoreRecord): Promise<void> {
    this.records.set(record.chunkId, record);
    return Promise.resolve();
  }

  search(
    tenantId: string,
    queryVector: number[],
    topK: number,
  ): Promise<VectorStoreSearchResult[]> {
    const results = [...this.records.values()]
      .filter((record) => record.tenantId === tenantId)
      .map((record) => ({
        record,
        score: this.cosineSimilarity(queryVector, record.vector),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    return Promise.resolve(results);
  }

  deleteByDocument(tenantId: string, documentId: string): Promise<void> {
    for (const [chunkId, record] of this.records) {
      if (record.tenantId === tenantId && record.documentId === documentId) {
        this.records.delete(chunkId);
      }
    }
    return Promise.resolve();
  }

  private cosineSimilarity(a: number[], b: number[]): number {
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
}
