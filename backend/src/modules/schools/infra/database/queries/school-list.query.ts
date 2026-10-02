import {
  addEq,
  addLike,
  addRaw,
  createFilterContext,
} from '../../../../../@core/infra/database/query-builder/filters';
import {
  buildPagedSelect,
  PagedQuery,
} from '../../../../../@core/infra/database/query-builder/paged-select';
import type { SchoolListFilter } from '../../../application/interface/repository/school.repository.interface';

export const SCHOOL_COLUMNS = [
  's.id',
  's.tenant_id',
  's.name',
  's.active',
  's.created_at',
  's.updated_at',
].join(', ');

export const SCHOOL_FROM = 'school s';

const ORDER_BY = 's.name ASC, s.id ASC';

/** Página e contagem das escolas não excluídas do tenant. */
export function buildSchoolListQuery(filter: SchoolListFilter): PagedQuery {
  const ctx = createFilterContext();
  addRaw(ctx, 's.tenant_id = :tenantId', { tenantId: filter.tenantId });
  addRaw(ctx, 's.deleted_at IS NULL');
  addEq(ctx, 's.active', 'active', filter.active);
  addLike(ctx, ['s.name'], 'search', filter.search);
  return buildPagedSelect({
    select: SCHOOL_COLUMNS,
    from: SCHOOL_FROM,
    ctx,
    orderBy: ORDER_BY,
    allowedOrderBy: [ORDER_BY],
    page: { page: filter.page, limit: filter.limit },
  });
}
