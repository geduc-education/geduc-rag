import { addEq, addIn, addLike, addRaw, createFilterContext } from '../filters';
import { buildPagedSelect, PageRequest } from '../paged-select';
import { CompiledQuery, InvalidQueryError, toPositional } from '../sql-params';

function expectSafe(query: CompiledQuery): void {
  expect(query.sql).not.toMatch(/:[a-zA-Z]/);
  expect(query.sql).not.toContain('${');
  expect((query.sql.match(/\?/g) ?? []).length).toBe(query.params.length);
}

describe('toPositional', () => {
  it('troca :nome por ? na ordem e repete o valor de nome repetido', () => {
    const query = toPositional('a = :x AND b = :x', { x: 1 });
    expect(query).toEqual({ sql: 'a = ? AND b = ?', params: [1, 1] });
    expectSafe(query);
  });

  it('mantém a ordem de ocorrência entre nomes diferentes', () => {
    const query = toPositional('a = :b AND c = :a', { a: 'A', b: 'B' });
    expect(query.params).toEqual(['B', 'A']);
    expectSafe(query);
  });

  it('lança InvalidQueryError quando falta valor para um :nome', () => {
    expect(() => toPositional('a = :x', {})).toThrow(InvalidQueryError);
  });

  it('aceita valor explicitamente undefined/null como presente', () => {
    const query = toPositional('a = :x', { x: null });
    expect(query.params).toEqual([null]);
  });
});

describe('filters', () => {
  it('addEq ignora undefined e null e mantém 0 e false', () => {
    const ctx = createFilterContext();
    addEq(ctx, 'a', 'a', undefined);
    addEq(ctx, 'b', 'b', null);
    addEq(ctx, 'c', 'c', 0);
    addEq(ctx, 'd', 'd', false);
    expect(ctx.where).toEqual(['c = :c', 'd = :d']);
    expect(ctx.params).toEqual({ c: 0, d: false });
  });

  it('addIn com undefined ignora e com [] gera 1 = 0', () => {
    const ctx = createFilterContext();
    addIn(ctx, 't.id', 'ids', undefined);
    expect(ctx.where).toEqual([]);
    addIn(ctx, 't.id', 'ids', []);
    expect(ctx.where).toEqual(['1 = 0']);
    expect(ctx.where.join(' ')).not.toContain('IN ()');
  });

  it('addIn com valores gera IN (:nome) com o array', () => {
    const ctx = createFilterContext();
    addIn(ctx, 't.id', 'ids', ['a', 'b']);
    expect(ctx.where).toEqual(['t.id IN (:ids)']);
    expect(ctx.params).toEqual({ ids: ['a', 'b'] });
  });

  it('addLike escapa \\, % e _ e envolve em %termo%', () => {
    const ctx = createFilterContext();
    addLike(ctx, ['u.name', 'u.email'], 'q', '  50%_a  ');
    expect(ctx.where).toEqual(['(u.name LIKE :q OR u.email LIKE :q)']);
    expect(ctx.params.q).toBe('%50\\%\\_a%');
  });

  it('addLike escapa barra invertida', () => {
    const ctx = createFilterContext();
    addLike(ctx, ['c'], 'q', 'a\\b');
    expect(ctx.params.q).toBe('%a\\\\b%');
  });

  it('addLike ignora termo vazio ou só espaços', () => {
    const ctx = createFilterContext();
    addLike(ctx, ['c'], 'q', '   ');
    addLike(ctx, ['c'], 'q', undefined);
    expect(ctx.where).toEqual([]);
    expect(ctx.params).toEqual({});
  });

  it('addRaw acrescenta fragmento fixo e params', () => {
    const ctx = createFilterContext();
    addRaw(ctx, 'u.deleted_at IS NULL');
    addRaw(ctx, 'EXISTS (SELECT 1 FROM x WHERE x.t = :t)', { t: 't1' });
    expect(ctx.where).toEqual([
      'u.deleted_at IS NULL',
      'EXISTS (SELECT 1 FROM x WHERE x.t = :t)',
    ]);
    expect(ctx.params).toEqual({ t: 't1' });
  });
});

describe('buildPagedSelect', () => {
  const page: PageRequest = { page: 2, limit: 20 };

  function build(
    overrides: Partial<Parameters<typeof buildPagedSelect>[0]> = {},
  ) {
    const ctx = createFilterContext();
    addEq(ctx, 'u.active', 'active', true);
    addLike(ctx, ['u.name'], 'q', 'ana');
    return buildPagedSelect({
      select: 'u.id, u.name',
      from: 'users u',
      ctx,
      orderBy: 'u.name ASC, u.id ASC',
      allowedOrderBy: ['u.name ASC, u.id ASC'],
      page,
      ...overrides,
    });
  }

  it('monta página com LIMIT ? OFFSET ? e params finais [limit, offset]', () => {
    const result = build();
    expect(result.page.sql).toBe(
      'SELECT u.id, u.name FROM users u WHERE u.active = ? AND (u.name LIKE ?) ORDER BY u.name ASC, u.id ASC LIMIT ? OFFSET ?',
    );
    expect(result.page.sql.endsWith('LIMIT ? OFFSET ?')).toBe(true);
    expect(result.page.params).toEqual([true, '%ana%', 20, 20]);
    expect(result.page.params.slice(-2)).toEqual([20, 20]);
    expectSafe(result.page);
  });

  it('monta contagem com o mesmo WHERE', () => {
    const result = build();
    expect(result.count.sql).toBe(
      'SELECT COUNT(*) AS total FROM users u WHERE u.active = ? AND (u.name LIKE ?)',
    );
    expect(result.count.params).toEqual([true, '%ana%']);
    expectSafe(result.count);
  });

  it('não emite WHERE sem filtros', () => {
    const result = buildPagedSelect({
      select: '*',
      from: 't',
      ctx: createFilterContext(),
      orderBy: 'id',
      allowedOrderBy: ['id'],
      page: { page: 1, limit: 10 },
    });
    expect(result.page.sql).toBe(
      'SELECT * FROM t ORDER BY id LIMIT ? OFFSET ?',
    );
    expect(result.page.params).toEqual([10, 0]);
    expect(result.count.sql).toBe('SELECT COUNT(*) AS total FROM t');
    expect(result.count.params).toEqual([]);
    expectSafe(result.page);
    expectSafe(result.count);
  });

  it('lança InvalidQueryError com orderBy fora da allow-list', () => {
    expect(() => build({ orderBy: 'u.password_hash' })).toThrow(
      InvalidQueryError,
    );
  });

  it.each([
    { page: 0, limit: 10 },
    { page: 1.5, limit: 10 },
    { page: 1, limit: 0 },
    { page: 1, limit: 101 },
    { page: 1, limit: 2.5 },
    { page: Number.NaN, limit: 10 },
  ])('lança InvalidQueryError com paginação inválida %o', (invalid) => {
    expect(() => build({ page: invalid })).toThrow(InvalidQueryError);
  });

  it('respeita maxLimit customizado', () => {
    expect(() => build({ page: { page: 1, limit: 30 }, maxLimit: 25 })).toThrow(
      InvalidQueryError,
    );
    expect(
      build({ page: { page: 1, limit: 500 }, maxLimit: 500 }).page.params.slice(
        -2,
      ),
    ).toEqual([500, 0]);
  });
});
