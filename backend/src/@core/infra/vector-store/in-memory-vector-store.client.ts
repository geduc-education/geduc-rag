import { Injectable } from '@nestjs/common';

export interface VectorStoreRecord {
  chunkId: string;
  documentId: string;
  tenantId: string;
  content: string;
  vector: number[];
}

export interface VectorStoreSearchResult {
  record: VectorStoreRecord;
  score: number;
}

/**
 * "SDK" fake de vector store — mesmo papel de uma conexão de banco compartilhada entre
 * módulos (`DATABASE_TENANT_CONNECTION` no geduc-api): recurso de infra único, encapsulado
 * pelo gateway PRÓPRIO de cada módulo consumidor (`embedding` escreve, `retrieval` lê).
 * Nunca é referenciado fora de `infra/gateways/` desses módulos. Isolamento por tenant é
 * OBRIGATÓRIO em toda busca (ver regra em `CLAUDE.md`).
 */
@Injectable()
export class InMemoryVectorStoreClient {
  private readonly records = new Map<string, VectorStoreRecord>();

  upsert(record: VectorStoreRecord): void {
    this.records.set(record.chunkId, record);
  }

  search(
    tenantId: string,
    queryVector: number[],
    topK: number,
  ): VectorStoreSearchResult[] {
    return [...this.records.values()]
      .filter((record) => record.tenantId === tenantId)
      .map((record) => ({
        record,
        score: this.cosineSimilarity(queryVector, record.vector),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
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
