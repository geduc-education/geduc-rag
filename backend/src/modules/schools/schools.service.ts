import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isMysqlDuplicateEntry } from '../../@core/shared/exceptions/400/duplicate-entry';
import { ERROR_CODES } from '../../common/errors/error-codes';
import {
  type ISchoolRepository,
  SCHOOL_REPOSITORY,
} from './application/interface/repository/school.repository.interface';
import {
  CreateSchoolDto,
  ListSchoolsDto,
  SchoolListResponseDto,
  SchoolResponseDto,
  UpdateSchoolDto,
} from './dto/school.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

/**
 * Cadastro de escolas do tenant da requisição (`@TenantId()`, já validado
 * pelo `TenantGuard`). Escola de outro tenant ou excluída responde 404
 * indistinto; o nome é único por tenant, inclusive entre excluídas.
 */
@Injectable()
export class SchoolsService {
  constructor(
    @Inject(SCHOOL_REPOSITORY)
    private readonly repository: ISchoolRepository,
  ) {}

  list(
    tenantId: string,
    query: ListSchoolsDto,
  ): Promise<SchoolListResponseDto> {
    return this.repository.list({
      tenantId,
      active: query.active,
      search: query.search,
      page: query.page ?? DEFAULT_PAGE,
      limit: query.limit ?? DEFAULT_LIMIT,
    });
  }

  findOne(tenantId: string, id: string): Promise<SchoolResponseDto> {
    return this.findOrFail(tenantId, id);
  }

  async create(
    tenantId: string,
    dto: CreateSchoolDto,
    actorId: string,
  ): Promise<SchoolResponseDto> {
    const name = dto.name.trim();
    await this.assertNameFree(tenantId, name);
    return this.withNameConflict(tenantId, name, () =>
      this.repository.create({
        tenantId,
        name,
        active: dto.active ?? true,
        createdById: actorId,
      }),
    );
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateSchoolDto,
    actorId: string,
  ): Promise<SchoolResponseDto> {
    await this.findOrFail(tenantId, id);
    const name = dto.name?.trim();
    await this.assertNameFree(tenantId, name, id);
    return this.withNameConflict(
      tenantId,
      name,
      () =>
        this.repository.update(tenantId, id, {
          name,
          active: dto.active,
          updatedById: actorId,
        }),
      id,
    );
  }

  /** Exclusão lógica: o nome segue reservado no tenant. */
  async remove(tenantId: string, id: string, actorId: string): Promise<void> {
    await this.findOrFail(tenantId, id);
    await this.repository.softDelete(tenantId, id, actorId);
  }

  private async findOrFail(
    tenantId: string,
    id: string,
  ): Promise<SchoolResponseDto> {
    const school = await this.repository.findById(tenantId, id);
    if (school) return school;
    throw new NotFoundException({
      code: ERROR_CODES.SCHOOL_NOT_FOUND,
      message: 'Escola não encontrada.',
    });
  }

  /** `name` indefinido (PATCH sem nome) não verifica. */
  private async assertNameFree(
    tenantId: string,
    name: string | undefined,
    selfId?: string,
  ): Promise<void> {
    if (name === undefined) return;
    const ownerId = await this.repository.findIdByName(tenantId, name);
    if (ownerId === null || ownerId === selfId) return;
    throw new ConflictException({
      code: ERROR_CODES.SCHOOL_NAME_TAKEN,
      message: 'Já existe uma escola com este nome.',
    });
  }

  /**
   * Corrida entre a checagem e a gravação: o unique do banco barra e a
   * checagem refeita devolve o 409.
   */
  private async withNameConflict<T>(
    tenantId: string,
    name: string | undefined,
    write: () => Promise<T>,
    selfId?: string,
  ): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (isMysqlDuplicateEntry(error)) {
        await this.assertNameFree(tenantId, name, selfId);
      }
      throw error;
    }
  }
}
