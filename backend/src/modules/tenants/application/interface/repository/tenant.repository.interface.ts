import type { TenantScope } from '../../../../../common/tenancy/tenant-access.service';

export const TENANT_REPOSITORY = 'ITenantRepository';

export interface TenantRecord {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  active: boolean;
  createdById: string;
  /** Usuário vinculado ao tenant na mesma transação; `null` = sem vínculo. */
  linkUserId: string | null;
}

export interface UpdateTenantInput {
  name?: string;
  slug?: string;
  active?: boolean;
  updatedById: string;
}

/** Cadastro de tenants; toda leitura ignora tenant excluído. */
export interface ITenantRepository {
  /** Ordenado por nome; `[]` devolve `[]` sem consultar. */
  list(scope: TenantScope): Promise<TenantRecord[]>;
  findById(id: string): Promise<TenantRecord | null>;
  create(input: CreateTenantInput): Promise<TenantRecord>;
  /** Grava só os campos definidos. */
  update(id: string, input: UpdateTenantInput): Promise<TenantRecord>;
  /** Quantos dos ids existem e não foram excluídos; `[]` devolve `0`. */
  countExisting(ids: readonly string[]): Promise<number>;
}
