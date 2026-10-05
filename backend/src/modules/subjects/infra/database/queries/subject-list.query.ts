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
import type { SubjectListFilter } from '../../../application/interface/repository/subject.repository.interface';

export const SUBJECT_COLUMNS = [
  'sub.id',
  'sub.tenant_id',
  'sub.name',
  'sub.active',
  'sub.created_at',
  'sub.updated_at',
].join(', ');

export const SUBJECT_FROM = 'subject sub';

const ORDER_BY = 'sub.name ASC, sub.id ASC';

/** Página e contagem das disciplinas não excluídas do tenant. */
export function buildSubjectListQuery(filter: SubjectListFilter): PagedQuery {
  const ctx = createFilterContext();
  addRaw(ctx, 'sub.tenant_id = :tenantId', { tenantId: filter.tenantId });
  addRaw(ctx, 'sub.deleted_at IS NULL');
  addEq(ctx, 'sub.active', 'active', filter.active);
  addLike(ctx, ['sub.name'], 'search', filter.search);
  return buildPagedSelect({
    select: SUBJECT_COLUMNS,
    from: SUBJECT_FROM,
    ctx,
    orderBy: ORDER_BY,
    allowedOrderBy: [ORDER_BY],
    page: { page: filter.page, limit: filter.limit },
  });
}
