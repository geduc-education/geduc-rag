export const SCHOOL_CLASS_REPOSITORY = 'ISchoolClassRepository';

/** Turma de uma escola do tenant num ano letivo. */
export interface SchoolClassRecord {
  id: string;
  tenantId: string;
  schoolId: string;
  schoolName: string;
  schoolYear: number;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SchoolClassListFilter {
  tenantId: string;
  schoolId?: string;
  schoolYear?: number;
  active?: boolean;
  /** Busca parcial no nome. */
  search?: string;
  page: number;
  limit: number;
}

export interface CreateSchoolClassInput {
  tenantId: string;
  schoolId: string;
  schoolYear: number;
  name: string;
  active: boolean;
  createdById: string;
}

/** `undefined` = não altera. Escola e ano letivo são imutáveis. */
export interface UpdateSchoolClassInput {
  name?: string;
  active?: boolean;
  updatedById: string;
}

/**
 * Cadastro de turmas. Todo método recebe `tenantId` e só enxerga o próprio
 * tenant; leituras ignoram turma excluída, salvo onde indicado.
 */
export interface ISchoolClassRepository {
  /** Ordenado por ano letivo (mais recente primeiro) e nome. */
  list(
    filter: SchoolClassListFilter,
  ): Promise<{ data: SchoolClassRecord[]; total: number }>;
  findById(tenantId: string, id: string): Promise<SchoolClassRecord | null>;
  /** Não filtra exclusão: o unique `(tenant, escola, ano, nome)` também não. */
  findIdByName(
    tenantId: string,
    schoolId: string,
    schoolYear: number,
    name: string,
  ): Promise<string | null>;
  /** Escola não excluída do tenant. */
  schoolExists(tenantId: string, schoolId: string): Promise<boolean>;
  create(input: CreateSchoolClassInput): Promise<SchoolClassRecord>;
  /** Grava só os campos definidos. */
  update(
    tenantId: string,
    id: string,
    input: UpdateSchoolClassInput,
  ): Promise<SchoolClassRecord>;
  /** `active = 0` e `deleted_at = NOW(3)`. */
  softDelete(tenantId: string, id: string, deletedById: string): Promise<void>;
}
