import { Injectable } from '@nestjs/common';
import { Document as PrismaDocument } from '@prisma/client';
import { PrismaService } from '../../../../../database/prisma.service';
import { DocumentEntity } from '../../../domain/entities/document.entity';
import { IDocumentRepository } from '../../../application/interface/repository/document.repository.interface';

/** Persistência MySQL dos documentos; toda consulta filtra por `tenantId` no `where`. */
@Injectable()
export class PrismaDocumentRepository implements IDocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(document: DocumentEntity): Promise<void> {
    await this.prisma.document.create({
      data: {
        id: document.documentId,
        tenantId: document.tenantId,
        filename: document.filename,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        content: document.content,
        status: document.status,
        errorMessage: document.errorMessage,
        embeddingModel: document.embeddingModel,
        embeddingVersion: document.embeddingVersion,
        createdById: document.createdById,
        createdAt: document.createdAt,
      },
    });
  }

  async findById(
    tenantId: string,
    documentId: string,
  ): Promise<DocumentEntity | null> {
    const row = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId },
    });
    return row ? this.toEntity(row) : null;
  }

  async save(document: DocumentEntity): Promise<void> {
    await this.prisma.document.updateMany({
      where: { id: document.documentId, tenantId: document.tenantId },
      data: {
        status: document.status,
        errorMessage: document.errorMessage,
        embeddingModel: document.embeddingModel,
        embeddingVersion: document.embeddingVersion,
      },
    });
  }

  async list(
    tenantId: string,
    page: number,
    limit: number,
  ): Promise<{ data: DocumentEntity[]; total: number }> {
    const where = { tenantId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.document.count({ where }),
    ]);
    return { data: rows.map((row) => this.toEntity(row)), total };
  }

  async delete(tenantId: string, documentId: string): Promise<boolean> {
    const { count } = await this.prisma.document.deleteMany({
      where: { id: documentId, tenantId },
    });
    return count > 0;
  }

  private toEntity(row: PrismaDocument): DocumentEntity {
    return DocumentEntity.create({
      documentId: row.id,
      tenantId: row.tenantId,
      filename: row.filename,
      content: row.content,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      createdById: row.createdById,
      status: row.status,
      errorMessage: row.errorMessage,
      embeddingModel: row.embeddingModel,
      embeddingVersion: row.embeddingVersion,
      createdAt: row.createdAt,
    });
  }
}
