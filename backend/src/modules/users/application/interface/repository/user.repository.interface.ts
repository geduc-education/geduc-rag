import type { TenantScope } from '../../../../../common/tenancy/tenant-access.service';

export const USER_REPOSITORY = 'IUserRepository';

/**
 * Usuário com vínculos, sem `passwordHash`. `profiles` só ativos e não
 * excluídos (`name ASC`); `tenants` só não excluídos (`name ASC`);
 * `permissionKeys` = chaves dos perfis ativos.
 */
export interface UserAggregate {
  id: string;
  name: string;
  email: string;
  active: boolean;
  mustChangePassword: boolean;
  isSuperAdmin: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  profiles: { id: string; name: string }[];
  tenants: { id: string; name: string; slug: string }[];
  permissionKeys: string[];
}

/** Dados de autenticação — único lugar onde o hash sai do repositório. */
export interface UserCredentials {
  id: string;
  email: string;
  passwordHash: string;
  active: boolean;
}

export interface UserListFilter {
  scope: TenantScope;
  active?: boolean;
  tenantId?: string;
  search?: string;
  page: number;
  limit: number;
}

export interface CreateUserInput {
  name: string;
  email: string;
  passwordHash: string;
  active: boolean;
  createdById: string;
  profileIds: readonly string[];
  tenantIds: readonly string[];
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  active?: boolean;
  updatedById: string;
  profileIds?: readonly string[];
}

export interface IUserRepository {
  list(
    filter: UserListFilter,
  ): Promise<{ data: UserAggregate[]; total: number }>;
  /** Não excluído e com vínculo no `scope`; `[]` devolve `null`. */
  findInScope(id: string, scope: TenantScope): Promise<UserAggregate | null>;
  findActiveById(id: string): Promise<UserAggregate | null>;
  /** Não filtra exclusão (equivale ao `findUniqueOrThrow`). */
  findById(id: string): Promise<UserAggregate | null>;
  findCredentialsByEmail(email: string): Promise<UserCredentials | null>;
  findActiveCredentialsById(id: string): Promise<UserCredentials | null>;
  /** Não filtra exclusão: o unique de e-mail é global. */
  findIdByEmail(email: string): Promise<string | null>;
  create(input: CreateUserInput): Promise<string>;
  update(id: string, input: UpdateUserInput): Promise<void>;
  replaceTenants(
    id: string,
    tenantIds: readonly string[],
    updatedById: string,
  ): Promise<void>;
  updatePassword(
    id: string,
    input: {
      passwordHash: string;
      mustChangePassword: boolean;
      updatedById?: string;
    },
  ): Promise<void>;
  touchLastLogin(id: string): Promise<void>;
  softDelete(id: string, deletedById: string): Promise<void>;
}
