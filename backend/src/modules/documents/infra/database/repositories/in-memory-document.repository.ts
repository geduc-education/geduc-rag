import { Injectable } from '@nestjs/common';
import { DocumentEntity } from '../../../domain/entities/document.entity';
import { IDocumentRepository } from '../../../application/interface/repository/document.repository.interface';

/** Ver `CLAUDE.md` ("Estado atual") — troca por repositório com `IDatabaseConnection` real. */
@Injectable()
export class InMemoryDocumentRepository implements IDocumentRepository {
  private readonly documents = new Map<string, DocumentEntity>();

  async create(document: DocumentEntity): Promise<void> {
    this.documents.set(
      this.key(document.tenantId, document.documentId),
      document,
    );
  }

  async findById(
    tenantId: string,
    documentId: string,
  ): Promise<DocumentEntity | null> {
    return this.documents.get(this.key(tenantId, documentId)) ?? null;
  }

  async save(document: DocumentEntity): Promise<void> {
    this.documents.set(
      this.key(document.tenantId, document.documentId),
      document,
    );
  }

  async list(
    tenantId: string,
    page: number,
    limit: number,
  ): Promise<{ data: DocumentEntity[]; total: number }> {
    const ofTenant = [...this.documents.values()]
      .filter((document) => document.tenantId === tenantId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const offset = (page - 1) * limit;
    return {
      data: ofTenant.slice(offset, offset + limit),
      total: ofTenant.length,
    };
  }

  async delete(tenantId: string, documentId: string): Promise<boolean> {
    return this.documents.delete(this.key(tenantId, documentId));
  }

  private key(tenantId: string, documentId: string): string {
    return `${tenantId}:${documentId}`;
  }
}
