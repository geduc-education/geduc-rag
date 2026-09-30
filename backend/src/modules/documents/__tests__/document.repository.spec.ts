import { IDatabaseConnection } from '../../../@core/application/adapters/database-connection.interface';
import { DocumentEntity } from '../domain/entities/document.entity';
import { DocumentRepository } from '../infra/database/repositories/document.repository';

type ConnectionMock = {
  [K in keyof IDatabaseConnection]: jest.Mock;
};

function makeConnection(): ConnectionMock {
  return {
    query: jest.fn().mockResolvedValue([]),
    queryOne: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockResolvedValue({ affectedRows: 1, insertId: 0 }),
    update: jest.fn().mockResolvedValue({ affectedRows: 1, insertId: 0 }),
    delete: jest.fn().mockResolvedValue({ affectedRows: 1, insertId: 0 }),
    runInTransaction: jest.fn(),
  };
}

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-1',
    tenant_id: 't1',
    filename: 'manual.md',
    mime_type: 'text/markdown',
    size_bytes: 42,
    content: 'conteúdo do manual',
    status: 'failed',
    error_message: 'embedding indisponível',
    embedding_model: null,
    embedding_version: null,
    created_by_id: 'user-1',
    created_at: new Date('2026-09-01T10:00:00Z'),
    updated_at: new Date('2026-09-01T10:05:00Z'),
    ...overrides,
  };
}

function makeEntity(): DocumentEntity {
  return DocumentEntity.create({
    documentId: 'doc-1',
    tenantId: 't1',
    filename: 'manual.md',
    content: 'conteúdo do manual',
    mimeType: 'text/markdown',
    createdById: 'user-1',
    createdAt: new Date('2026-09-01T10:00:00Z'),
  });
}

/** SQL sem `:nome` sobrando e com um `?` por param. */
function expectWellFormed(sql: string, params: readonly unknown[]): void {
  expect(sql).not.toMatch(/:[A-Za-z]/);
  expect(sql).not.toContain('${');
  expect((sql.match(/\?/g) ?? []).length).toBe(params.length);
}

function expectTenantScoped(sql: string, params: readonly unknown[]): void {
  expectWellFormed(sql, params);
  const where = sql.slice(sql.toUpperCase().indexOf('WHERE'));
  expect(where).toMatch(/tenant_id = \?/);
  expect(params).toContain('t1');
}

function lastCall(mock: jest.Mock): [string, unknown[]] {
  const calls = mock.mock.calls as [string, unknown[]][];
  return calls[calls.length - 1];
}

describe('DocumentRepository', () => {
  let connection: ConnectionMock;
  let repository: DocumentRepository;

  beforeEach(() => {
    connection = makeConnection();
    repository = new DocumentRepository(connection);
  });

  it('create grava tenant_id e updated_at = NOW(3)', async () => {
    await repository.create(makeEntity());

    const [sql, params] = lastCall(connection.insert);
    expectWellFormed(sql, params);
    expect(sql).toMatch(/INSERT INTO `?document`?/);
    expect(sql).toContain('tenant_id');
    expect(sql).toContain('updated_at');
    expect(sql).toContain('NOW(3)');
    expect(params).toContain('t1');
    expect(params).toContain('doc-1');
    expect(params).toContainEqual(new Date('2026-09-01T10:00:00Z'));
  });

  it('findById filtra por id e tenant_id e mapeia a row', async () => {
    connection.queryOne.mockResolvedValue(makeRow());

    const found = await repository.findById('t1', 'doc-1');

    const [sql, params] = lastCall(connection.queryOne);
    expectTenantScoped(sql, params);
    expect(found).toBeInstanceOf(DocumentEntity);
    expect(found).toMatchObject({
      documentId: 'doc-1',
      tenantId: 't1',
      mimeType: 'text/markdown',
      sizeBytes: 42,
      status: 'failed',
      errorMessage: 'embedding indisponível',
      createdById: 'user-1',
      createdAt: new Date('2026-09-01T10:00:00Z'),
    });
  });

  it('findById devolve null quando não há row', async () => {
    await expect(repository.findById('t1', 'x')).resolves.toBeNull();
  });

  it('save atualiza status e updated_at no escopo do tenant', async () => {
    const entity = makeEntity();
    entity.markReady('text-embedding-3-small', 'v1');

    await repository.save(entity);

    const [sql, params] = lastCall(connection.update);
    expectTenantScoped(sql, params);
    expect(sql).toBe(
      'UPDATE document SET status = ?, error_message = ?, embedding_model = ?, embedding_version = ?, updated_at = NOW(3) WHERE id = ? AND tenant_id = ?',
    );
    expect(params).toEqual([
      'ready',
      null,
      'text-embedding-3-small',
      'v1',
      'doc-1',
      't1',
    ]);
  });

  it('list pagina por created_at desc e devolve { data, total }', async () => {
    connection.query.mockResolvedValue([makeRow()]);
    connection.queryOne.mockResolvedValue({ total: 11 });

    const result = await repository.list('t1', 2, 10);

    const [pageSql, pageParams] = lastCall(connection.query);
    expectTenantScoped(pageSql, pageParams);
    expect(pageSql).toContain('ORDER BY created_at DESC');
    expect(pageSql).toMatch(/LIMIT \? OFFSET \?$/);
    expect(pageParams.slice(-2)).toEqual([10, 10]);

    const [countSql, countParams] = lastCall(connection.queryOne);
    expectTenantScoped(countSql, countParams);
    expect(countSql).toContain('COUNT(*)');

    expect(result.total).toBe(11);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toBeInstanceOf(DocumentEntity);
    expect(result.data[0].documentId).toBe('doc-1');
  });

  it('list converte total textual e trata contagem ausente como 0', async () => {
    connection.queryOne.mockResolvedValueOnce({ total: '3' });
    await expect(repository.list('t1', 1, 20)).resolves.toMatchObject({
      total: 3,
    });

    connection.queryOne.mockResolvedValueOnce(null);
    await expect(repository.list('t1', 1, 20)).resolves.toMatchObject({
      total: 0,
    });
  });

  it('delete filtra por tenant_id e devolve affectedRows > 0', async () => {
    await expect(repository.delete('t1', 'doc-1')).resolves.toBe(true);
    const [sql, params] = lastCall(connection.delete);
    expectTenantScoped(sql, params);

    connection.delete.mockResolvedValue({ affectedRows: 0, insertId: 0 });
    await expect(repository.delete('t1', 'x')).resolves.toBe(false);
  });
});
