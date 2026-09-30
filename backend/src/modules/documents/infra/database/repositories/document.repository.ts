import { IDatabaseConnection } from '../../../../../@core/application/adapters/database-connection.interface';
import {
  addEq,
  createFilterContext,
} from '../../../../../@core/infra/database/query-builder/filters';
import { buildPagedSelect } from '../../../../../@core/infra/database/query-builder/paged-select';
import {
  DocumentEntity,
  DocumentStatus,
} from '../../../domain/entities/document.entity';
import { IDocumentRepository } from '../../../application/interface/repository/document.repository.interface';

/** Row da tabela `document` (colunas snake_case da migration). */
interface DocumentRow {
  id: string;
  tenant_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  content: string;
  status: DocumentStatus;
  error_message: string | null;
  embedding_model: string | null;
  embedding_version: string | null;
  created_by_id: string | null;
  created_at: Date;
}

const COLUMNS =
  'id, tenant_id, filename, mime_type, size_bytes, content, status, error_message, embedding_model, embedding_version, created_by_id, created_at';

const ORDER_BY = 'created_at DESC';

/** Persistência MySQL dos documentos; todo acesso filtra por `tenant_id`. */
export class DocumentRepository implements IDocumentRepository {
  constructor(private readonly connection: IDatabaseConnection) {}

  async create(document: DocumentEntity): Promise<void> {
    await this.connection.insert(
      `INSERT INTO document (${COLUMNS}, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
      [
        document.documentId,
        document.tenantId,
        document.filename,
        document.mimeType,
        document.sizeBytes,
        document.content,
        document.status,
        document.errorMessage,
        document.embeddingModel,
        document.embeddingVersion,
        document.createdById,
        document.createdAt,
      ],
    );
  }

  async findById(
    tenantId: string,
    documentId: string,
  ): Promise<DocumentEntity | null> {
    const row = await this.connection.queryOne<DocumentRow>(
      `SELECT ${COLUMNS} FROM document WHERE id = ? AND tenant_id = ?`,
      [documentId, tenantId],
    );
    return row ? toEntity(row) : null;
  }

  async save(document: DocumentEntity): Promise<void> {
    await this.connection.update(
      'UPDATE document SET status = ?, error_message = ?, embedding_model = ?, embedding_version = ?, updated_at = NOW(3) WHERE id = ? AND tenant_id = ?',
      [
        document.status,
        document.errorMessage,
        document.embeddingModel,
        document.embeddingVersion,
        document.documentId,
        document.tenantId,
      ],
    );
  }

  async list(
    tenantId: string,
    page: number,
    limit: number,
  ): Promise<{ data: DocumentEntity[]; total: number }> {
    const ctx = createFilterContext();
    addEq(ctx, 'tenant_id', 'tenantId', tenantId);
    const paged = buildPagedSelect({
      select: COLUMNS,
      from: 'document',
      ctx,
      orderBy: ORDER_BY,
      allowedOrderBy: [ORDER_BY],
      page: { page, limit },
    });
    const [rows, count] = await Promise.all([
      this.connection.query<DocumentRow>(paged.page.sql, paged.page.params),
      this.connection.queryOne<{ total: number | string }>(
        paged.count.sql,
        paged.count.params,
      ),
    ]);
    return { data: rows.map(toEntity), total: Number(count?.total ?? 0) };
  }

  async delete(tenantId: string, documentId: string): Promise<boolean> {
    const { affectedRows } = await this.connection.delete(
      'DELETE FROM document WHERE id = ? AND tenant_id = ?',
      [documentId, tenantId],
    );
    return affectedRows > 0;
  }
}

function toEntity(row: DocumentRow): DocumentEntity {
  return DocumentEntity.create({
    documentId: row.id,
    tenantId: row.tenant_id,
    filename: row.filename,
    content: row.content,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdById: row.created_by_id,
    status: row.status,
    errorMessage: row.error_message,
    embeddingModel: row.embedding_model,
    embeddingVersion: row.embedding_version,
    createdAt: row.created_at,
  });
}
