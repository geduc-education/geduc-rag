export const EMPLOYEE_REPOSITORY = 'IEmployeeRepository';

/** Funcionário de um tenant; `document` é o CPF só com dígitos. */
export interface EmployeeRecord {
  id: string;
  tenantId: string;
  userId: string | null;
  name: string;
  email: string;
  document: string;
  position: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeeListFilter {
  tenantId: string;
  active?: boolean;
  /** Busca parcial em nome, e-mail ou CPF. */
  search?: string;
  page: number;
  limit: number;
}

export interface CreateEmployeeInput {
  tenantId: string;
  userId: string | null;
  name: string;
  email: string;
  document: string;
  position: string | null;
  active: boolean;
  createdById: string;
}

/** `undefined` = não altera; `null` em `userId`/`position` limpa o campo. */
export interface UpdateEmployeeInput {
  userId?: string | null;
  name?: string;
  email?: string;
  document?: string;
  position?: string | null;
  active?: boolean;
  updatedById: string;
}

/**
 * Cadastro de funcionários. Todo método recebe `tenantId` e só enxerga o
 * próprio tenant; leituras ignoram funcionário excluído, salvo onde indicado.
 */
export interface IEmployeeRepository {
  /** Ordenado por nome. */
  list(
    filter: EmployeeListFilter,
  ): Promise<{ data: EmployeeRecord[]; total: number }>;
  findById(tenantId: string, id: string): Promise<EmployeeRecord | null>;
  /** Não filtra exclusão: o unique `(tenant_id, email)` também não. */
  findIdByEmail(tenantId: string, email: string): Promise<string | null>;
  /** Não filtra exclusão: o unique `(tenant_id, document)` também não. */
  findIdByDocument(tenantId: string, document: string): Promise<string | null>;
  /** Não filtra exclusão: o unique `(tenant_id, user_id)` também não. */
  findIdByUserId(tenantId: string, userId: string): Promise<string | null>;
  create(input: CreateEmployeeInput): Promise<EmployeeRecord>;
  /** Grava só os campos definidos. */
  update(
    tenantId: string,
    id: string,
    input: UpdateEmployeeInput,
  ): Promise<EmployeeRecord>;
  softDelete(tenantId: string, id: string, deletedById: string): Promise<void>;
  /**
   * Remove a linha de vez, excluída logicamente ou não. `false` quando não
   * havia funcionário com o `id` no tenant.
   */
  hardDelete(tenantId: string, id: string): Promise<boolean>;
}
