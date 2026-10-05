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
import type { SchoolClassListFilter } from '../../../application/interface/repository/school-class.repository.interface';

export const SCHOOL_CLASS_COLUMNS = [
  'sc.id',
  'sc.tenant_id',
  'sc.school_id',
  'sch.name AS school_name',
  'sc.school_year',
  'sc.name',
  'sc.active',
  'sc.created_at',
  'sc.updated_at',
].join(', ');

export const SCHOOL_CLASS_FROM =
  'school_class sc JOIN school sch ON sch.id = sc.school_id AND sch.tenant_id = sc.tenant_id';

const ORDER_BY = 'sc.school_year DESC, sc.name ASC, sc.id ASC';

/** Página e contagem das turmas não excluídas do tenant. */
export function buildSchoolClassListQuery(
  filter: SchoolClassListFilter,
): PagedQuery {
  const ctx = createFilterContext();
  addRaw(ctx, 'sc.tenant_id = :tenantId', { tenantId: filter.tenantId });
  addRaw(ctx, 'sc.deleted_at IS NULL');
  addEq(ctx, 'sc.school_id', 'schoolId', filter.schoolId);
  addEq(ctx, 'sc.school_year', 'schoolYear', filter.schoolYear);
  addEq(ctx, 'sc.active', 'active', filter.active);
  addLike(ctx, ['sc.name'], 'search', filter.search);
  return buildPagedSelect({
    select: SCHOOL_CLASS_COLUMNS,
    from: SCHOOL_CLASS_FROM,
    ctx,
    orderBy: ORDER_BY,
    allowedOrderBy: [ORDER_BY],
    page: { page: filter.page, limit: filter.limit },
  });
}
