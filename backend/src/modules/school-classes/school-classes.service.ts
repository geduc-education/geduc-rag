import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isMysqlDuplicateEntry } from '../../@core/shared/exceptions/400/duplicate-entry';
import { ERROR_CODES } from '../../common/errors/error-codes';
import {
  type ISchoolClassRepository,
  SCHOOL_CLASS_REPOSITORY,
} from './application/interface/repository/school-class.repository.interface';
import {
  CreateSchoolClassDto,
  ListSchoolClassesDto,
  SchoolClassListResponseDto,
  SchoolClassResponseDto,
  UpdateSchoolClassDto,
} from './dto/school-class.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

/** Chave do unique da turma: o nome é único por escola e ano letivo. */
interface NameScope {
  tenantId: string;
  schoolId: string;
  schoolYear: number;
}

/**
 * Cadastro de turmas do tenant da requisição (`@TenantId()`, já validado
 * pelo `TenantGuard`). Turma de outro tenant ou excluída responde 404
 * indistinto; a escola precisa existir no tenant e não estar excluída; o
 * nome é único por `(escola, ano letivo)`, inclusive entre excluídas.
 */
@Injectable()
export class SchoolClassesService {
  constructor(
    @Inject(SCHOOL_CLASS_REPOSITORY)
    private readonly repository: ISchoolClassRepository,
  ) {}

  list(
    tenantId: string,
    query: ListSchoolClassesDto,
  ): Promise<SchoolClassListResponseDto> {
    return this.repository.list({
      tenantId,
      schoolId: query.schoolId,
      schoolYear: query.schoolYear,
      active: query.active,
      search: query.search,
      page: query.page ?? DEFAULT_PAGE,
      limit: query.limit ?? DEFAULT_LIMIT,
    });
  }

  findOne(tenantId: string, id: string): Promise<SchoolClassResponseDto> {
    return this.findOrFail(tenantId, id);
  }

  async create(
    tenantId: string,
    dto: CreateSchoolClassDto,
    actorId: string,
  ): Promise<SchoolClassResponseDto> {
    const scope = {
      tenantId,
      schoolId: dto.schoolId,
      schoolYear: dto.schoolYear,
    };
    const name = dto.name.trim();
    await this.assertSchoolValid(tenantId, dto.schoolId);
    await this.assertNameFree(scope, name);
    return this.withNameConflict(scope, name, () =>
      this.repository.create({
        ...scope,
        name,
        active: dto.active ?? true,
        createdById: actorId,
      }),
    );
  }

  /** Escola e ano letivo são imutáveis: o nome é verificado nos da turma. */
  async update(
    tenantId: string,
    id: string,
    dto: UpdateSchoolClassDto,
    actorId: string,
  ): Promise<SchoolClassResponseDto> {
    const current = await this.findOrFail(tenantId, id);
    const scope = {
      tenantId,
      schoolId: current.schoolId,
      schoolYear: current.schoolYear,
    };
    const name = dto.name?.trim();
    await this.assertNameFree(scope, name, id);
    return this.withNameConflict(
      scope,
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

  /** Exclusão lógica: o nome segue reservado na escola e no ano. */
  async remove(tenantId: string, id: string, actorId: string): Promise<void> {
    await this.findOrFail(tenantId, id);
    await this.repository.softDelete(tenantId, id, actorId);
  }

  private async findOrFail(
    tenantId: string,
    id: string,
  ): Promise<SchoolClassResponseDto> {
    const schoolClass = await this.repository.findById(tenantId, id);
    if (schoolClass) return schoolClass;
    throw new NotFoundException({
      code: ERROR_CODES.SCHOOL_CLASS_NOT_FOUND,
      message: 'Turma não encontrada.',
    });
  }

  /** Escola inexistente, excluída ou de outro tenant respondem o mesmo 400. */
  private async assertSchoolValid(
    tenantId: string,
    schoolId: string,
  ): Promise<void> {
    if (await this.repository.schoolExists(tenantId, schoolId)) return;
    throw new BadRequestException({
      code: ERROR_CODES.SCHOOL_CLASS_SCHOOL_INVALID,
      message: 'Escola inválida para a turma.',
    });
  }

  /** `name` indefinido (PATCH sem nome) não verifica. */
  private async assertNameFree(
    scope: NameScope,
    name: string | undefined,
    selfId?: string,
  ): Promise<void> {
    if (name === undefined) return;
    const ownerId = await this.repository.findIdByName(
      scope.tenantId,
      scope.schoolId,
      scope.schoolYear,
      name,
    );
    if (ownerId === null || ownerId === selfId) return;
    throw new ConflictException({
      code: ERROR_CODES.SCHOOL_CLASS_NAME_TAKEN,
      message: 'Já existe uma turma com este nome na escola e no ano letivo.',
    });
  }

  /**
   * Corrida entre a checagem e a gravação: o unique do banco barra e a
   * checagem refeita devolve o 409.
   */
  private async withNameConflict<T>(
    scope: NameScope,
    name: string | undefined,
    write: () => Promise<T>,
    selfId?: string,
  ): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (isMysqlDuplicateEntry(error)) {
        await this.assertNameFree(scope, name, selfId);
      }
      throw error;
    }
  }
}
