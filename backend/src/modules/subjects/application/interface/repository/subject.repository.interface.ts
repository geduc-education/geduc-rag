export const SUBJECT_REPOSITORY = 'ISubjectRepository';

/** Disciplina de um tenant. */
export interface SubjectRecord {
  id: string;
  tenantId: string;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubjectListFilter {
  tenantId: string;
  active?: boolean;
  /** Busca parcial no nome. */
  search?: string;
  page: number;
  limit: number;
}

export interface CreateSubjectInput {
  tenantId: string;
  name: string;
  active: boolean;
  createdById: string;
}

/** `undefined` = não altera. */
export interface UpdateSubjectInput {
  name?: string;
  active?: boolean;
  updatedById: string;
}

/**
 * Cadastro de disciplinas. Todo método recebe `tenantId` e só enxerga o próprio
 * tenant; leituras ignoram disciplina excluída, salvo onde indicado.
 */
export interface ISubjectRepository {
  /** Ordenado por nome. */
  list(
    filter: SubjectListFilter,
  ): Promise<{ data: SubjectRecord[]; total: number }>;
  findById(tenantId: string, id: string): Promise<SubjectRecord | null>;
  /** Não filtra exclusão: o unique `(tenant_id, name)` também não. */
  findIdByName(tenantId: string, name: string): Promise<string | null>;
  create(input: CreateSubjectInput): Promise<SubjectRecord>;
  /** Grava só os campos definidos. */
  update(
    tenantId: string,
    id: string,
    input: UpdateSubjectInput,
  ): Promise<SubjectRecord>;
  /** `active = 0` e `deleted_at = NOW(3)`. */
  softDelete(tenantId: string, id: string, deletedById: string): Promise<void>;
}
