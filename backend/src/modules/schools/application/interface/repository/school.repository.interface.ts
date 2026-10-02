export const SCHOOL_REPOSITORY = 'ISchoolRepository';

/** Escola de um tenant. */
export interface SchoolRecord {
  id: string;
  tenantId: string;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SchoolListFilter {
  tenantId: string;
  active?: boolean;
  /** Busca parcial no nome. */
  search?: string;
  page: number;
  limit: number;
}

export interface CreateSchoolInput {
  tenantId: string;
  name: string;
  active: boolean;
  createdById: string;
}

/** `undefined` = não altera. */
export interface UpdateSchoolInput {
  name?: string;
  active?: boolean;
  updatedById: string;
}

/**
 * Cadastro de escolas. Todo método recebe `tenantId` e só enxerga o próprio
 * tenant; leituras ignoram escola excluída, salvo onde indicado.
 */
export interface ISchoolRepository {
  /** Ordenado por nome. */
  list(
    filter: SchoolListFilter,
  ): Promise<{ data: SchoolRecord[]; total: number }>;
  findById(tenantId: string, id: string): Promise<SchoolRecord | null>;
  /** Não filtra exclusão: o unique `(tenant_id, name)` também não. */
  findIdByName(tenantId: string, name: string): Promise<string | null>;
  create(input: CreateSchoolInput): Promise<SchoolRecord>;
  /** Grava só os campos definidos. */
  update(
    tenantId: string,
    id: string,
    input: UpdateSchoolInput,
  ): Promise<SchoolRecord>;
  /** `active = 0` e `deleted_at = NOW(3)`. */
  softDelete(tenantId: string, id: string, deletedById: string): Promise<void>;
}
