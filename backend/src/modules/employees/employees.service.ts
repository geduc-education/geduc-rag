import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isMysqlDuplicateEntry } from '../../@core/shared/exceptions/400/duplicate-entry';
import { ERROR_CODES, type ErrorCode } from '../../common/errors/error-codes';
import { TenantAccessService } from '../../common/tenancy/tenant-access.service';
import { normalizeEmail } from '../users/users.policy';
import {
  EMPLOYEE_REPOSITORY,
  type IEmployeeRepository,
} from './application/interface/repository/employee.repository.interface';
import {
  CreateEmployeeDto,
  EmployeeListResponseDto,
  EmployeeResponseDto,
  ListEmployeesDto,
  UpdateEmployeeDto,
} from './dto/employee.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

/** Campos com unique por tenant; `undefined` = não verificar. */
interface UniqueFields {
  email?: string;
  document?: string;
  userId?: string | null;
}

/** `undefined` mantém; vazio vira `null` (coluna NULLABLE). */
function normalizePosition(
  position: string | null | undefined,
): string | null | undefined {
  if (position === undefined || position === null) return position;
  return position.trim() || null;
}

/**
 * Cadastro de funcionários do tenant da requisição (`@TenantId()`, já
 * validado pelo `TenantGuard`). Funcionário de outro tenant ou excluído
 * responde 404 indistinto.
 */
@Injectable()
export class EmployeesService {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY)
    private readonly repository: IEmployeeRepository,
    private readonly tenantAccess: TenantAccessService,
  ) {}

  list(
    tenantId: string,
    query: ListEmployeesDto,
  ): Promise<EmployeeListResponseDto> {
    return this.repository.list({
      tenantId,
      active: query.active,
      search: query.search,
      page: query.page ?? DEFAULT_PAGE,
      limit: query.limit ?? DEFAULT_LIMIT,
    });
  }

  findOne(tenantId: string, id: string): Promise<EmployeeResponseDto> {
    return this.findOrFail(tenantId, id);
  }

  async create(
    tenantId: string,
    dto: CreateEmployeeDto,
    actorId: string,
  ): Promise<EmployeeResponseDto> {
    const fields = {
      email: normalizeEmail(dto.email),
      document: dto.document,
      userId: dto.userId ?? null,
    };
    await this.assertWritable(tenantId, fields);
    return this.withUniqueConflict(tenantId, fields, () =>
      this.repository.create({
        tenantId,
        ...fields,
        name: dto.name.trim(),
        position: normalizePosition(dto.position) ?? null,
        active: dto.active ?? true,
        createdById: actorId,
      }),
    );
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateEmployeeDto,
    actorId: string,
  ): Promise<EmployeeResponseDto> {
    await this.findOrFail(tenantId, id);
    const fields = {
      email: dto.email === undefined ? undefined : normalizeEmail(dto.email),
      document: dto.document,
      userId: dto.userId,
    };
    await this.assertWritable(tenantId, fields, id);
    return this.withUniqueConflict(
      tenantId,
      fields,
      () =>
        this.repository.update(tenantId, id, {
          ...fields,
          name: dto.name?.trim(),
          position: normalizePosition(dto.position),
          active: dto.active,
          updatedById: actorId,
        }),
      id,
    );
  }

  /** Exclusão lógica: e-mail, CPF e usuário seguem reservados no tenant. */
  async remove(tenantId: string, id: string, actorId: string): Promise<void> {
    await this.findOrFail(tenantId, id);
    await this.repository.softDelete(tenantId, id, actorId);
  }

  /** Exclusão definitiva; alcança também o funcionário já excluído. */
  async purge(tenantId: string, id: string): Promise<void> {
    const removed = await this.repository.hardDelete(tenantId, id);
    if (!removed) throw this.notFound();
  }

  private async findOrFail(
    tenantId: string,
    id: string,
  ): Promise<EmployeeResponseDto> {
    const employee = await this.repository.findById(tenantId, id);
    if (!employee) throw this.notFound();
    return employee;
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: ERROR_CODES.EMPLOYEE_NOT_FOUND,
      message: 'Funcionário não encontrado.',
    });
  }

  private async assertWritable(
    tenantId: string,
    fields: UniqueFields,
    selfId?: string,
  ): Promise<void> {
    await this.assertUserLinkable(tenantId, fields.userId);
    await this.assertUnique(tenantId, fields, selfId);
  }

  /**
   * O usuário precisa estar ativo e com acesso ao tenant. Inexistente e sem
   * vínculo respondem igual, para não revelar usuário fora do alcance.
   */
  private async assertUserLinkable(
    tenantId: string,
    userId: string | null | undefined,
  ): Promise<void> {
    if (!userId) return;
    if (await this.tenantAccess.canAccess(userId, tenantId)) return;
    throw new BadRequestException({
      code: ERROR_CODES.EMPLOYEE_USER_NOT_LINKABLE,
      message: 'O usuário informado não pode ser vinculado a este tenant.',
    });
  }

  private async assertUnique(
    tenantId: string,
    fields: UniqueFields,
    selfId?: string,
  ): Promise<void> {
    const [byEmail, byDocument, byUser] = await Promise.all([
      fields.email
        ? this.repository.findIdByEmail(tenantId, fields.email)
        : null,
      fields.document
        ? this.repository.findIdByDocument(tenantId, fields.document)
        : null,
      fields.userId
        ? this.repository.findIdByUserId(tenantId, fields.userId)
        : null,
    ]);
    const taken = (id: string | null) => id !== null && id !== selfId;
    if (taken(byEmail)) {
      throw conflict(
        ERROR_CODES.EMPLOYEE_EMAIL_TAKEN,
        'Este e-mail já está em uso.',
      );
    }
    if (taken(byDocument)) {
      throw conflict(
        ERROR_CODES.EMPLOYEE_DOCUMENT_TAKEN,
        'Este CPF já está em uso.',
      );
    }
    if (taken(byUser)) {
      throw conflict(
        ERROR_CODES.EMPLOYEE_USER_ALREADY_LINKED,
        'Este usuário já está vinculado a outro funcionário.',
      );
    }
  }

  /**
   * Corrida entre a checagem e a gravação: o unique do banco barra e a
   * checagem refeita aponta qual campo colidiu.
   */
  private async withUniqueConflict<T>(
    tenantId: string,
    fields: UniqueFields,
    write: () => Promise<T>,
    selfId?: string,
  ): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (isMysqlDuplicateEntry(error)) {
        await this.assertUnique(tenantId, fields, selfId);
      }
      throw error;
    }
  }
}

function conflict(code: ErrorCode, message: string): ConflictException {
  return new ConflictException({ code, message });
}
