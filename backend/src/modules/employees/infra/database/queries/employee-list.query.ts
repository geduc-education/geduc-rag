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
import type { EmployeeListFilter } from '../../../application/interface/repository/employee.repository.interface';

export const EMPLOYEE_COLUMNS = [
  'e.id',
  'e.tenant_id',
  'e.user_id',
  'e.name',
  'e.email',
  'e.document',
  'e.position',
  'e.active',
  'e.created_at',
  'e.updated_at',
].join(', ');

export const EMPLOYEE_FROM = 'employee e';

const ORDER_BY = 'e.name ASC, e.id ASC';

/** Página e contagem dos funcionários não excluídos do tenant. */
export function buildEmployeeListQuery(filter: EmployeeListFilter): PagedQuery {
  const ctx = createFilterContext();
  addRaw(ctx, 'e.tenant_id = :tenantId', { tenantId: filter.tenantId });
  addRaw(ctx, 'e.deleted_at IS NULL');
  addEq(ctx, 'e.active', 'active', filter.active);
  addLike(ctx, ['e.name', 'e.email', 'e.document'], 'search', filter.search);
  return buildPagedSelect({
    select: EMPLOYEE_COLUMNS,
    from: EMPLOYEE_FROM,
    ctx,
    orderBy: ORDER_BY,
    allowedOrderBy: [ORDER_BY],
    page: { page: filter.page, limit: filter.limit },
  });
}
