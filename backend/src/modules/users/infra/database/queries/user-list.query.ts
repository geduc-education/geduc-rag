import {
  addEq,
  addLike,
  addRaw,
  createFilterContext,
  FilterContext,
} from '../../../../../@core/infra/database/query-builder/filters';
import {
  buildPagedSelect,
  PagedQuery,
} from '../../../../../@core/infra/database/query-builder/paged-select';
import type { TenantScope } from '../../../../../common/tenancy/tenant-access.service';
import type { UserListFilter } from '../../../application/interface/repository/user.repository.interface';

/** Colunas do agregado — nunca `password_hash`. */
export const USER_COLUMNS = [
  'u.id',
  'u.name',
  'u.email',
  'u.active',
  'u.must_change_password',
  'u.is_super_admin',
  'u.last_login_at',
  'u.created_at',
  'u.updated_at',
].join(', ');

export const USER_FROM = '`user` u';

const ORDER_BY = 'u.name ASC, u.id ASC';

const SCOPE_EXISTS =
  'EXISTS (SELECT 1 FROM user_tenant ut WHERE ut.user_id = u.id AND ut.tenant_id IN (:scopeTenantIds))';

const TENANT_EXISTS =
  'EXISTS (SELECT 1 FROM user_tenant utf WHERE utf.user_id = u.id AND utf.tenant_id = :tenantId)';

/**
 * Restringe ao alcance: `'all'` não filtra; lista vira `EXISTS` no vínculo.
 * Lista vazia não chega aqui (o repositório responde vazio antes).
 */
export function addScope(ctx: FilterContext, scope: TenantScope): void {
  if (scope === 'all') return;
  addRaw(ctx, SCOPE_EXISTS, { scopeTenantIds: [...scope] });
}

/** Página e contagem da listagem de usuários não excluídos no alcance. */
export function buildUserListQuery(filter: UserListFilter): PagedQuery {
  const ctx = createFilterContext();
  addRaw(ctx, 'u.deleted_at IS NULL');
  addScope(ctx, filter.scope);
  addEq(ctx, 'u.active', 'active', filter.active);
  if (filter.tenantId)
    addRaw(ctx, TENANT_EXISTS, { tenantId: filter.tenantId });
  addLike(ctx, ['u.name', 'u.email'], 'search', filter.search);
  return buildPagedSelect({
    select: USER_COLUMNS,
    from: USER_FROM,
    ctx,
    orderBy: ORDER_BY,
    allowedOrderBy: [ORDER_BY],
    page: { page: filter.page, limit: filter.limit },
  });
}
