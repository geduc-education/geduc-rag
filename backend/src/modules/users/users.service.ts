import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { isMysqlDuplicateEntry } from '../../@core/shared/exceptions/400/duplicate-entry';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { EffectivePermissionsService } from '../../common/rbac/effective-permissions.service';
import {
  scopeOf,
  TenantAccessService,
} from '../../common/tenancy/tenant-access.service';
import {
  type IProfileRepository,
  PROFILE_REPOSITORY,
} from '../profiles/application/interface/repository/profile.repository.interface';
import {
  type ITenantRepository,
  TENANT_REPOSITORY,
} from '../tenants/application/interface/repository/tenant.repository.interface';
import {
  type IUserRepository,
  USER_REPOSITORY,
  type UserAggregate,
} from './application/interface/repository/user.repository.interface';
import { AssignUserTenantsDto } from './dto/assign-user-tenants.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserListResponseDto, UserResponseDto } from './dto/user-response.dto';
import { toUserResponse } from './users.mapper';
import {
  assertCanDisable,
  assertCanModify,
  assertPermissionsGrantable,
  assertTenantsGrantable,
  changedIds,
  mergeTenantAssignment,
  normalizeEmail,
  UserActor,
} from './users.policy';

const DEFAULT_PAGE_SIZE = 20;

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly users: IUserRepository,
    @Inject(PROFILE_REPOSITORY)
    private readonly profiles: IProfileRepository,
    @Inject(TENANT_REPOSITORY)
    private readonly tenants: ITenantRepository,
    private readonly permissions: EffectivePermissionsService,
    private readonly tenantAccess: TenantAccessService,
  ) {}

  async list(
    query: ListUsersDto,
    actorId: string,
  ): Promise<UserListResponseDto> {
    const actor = await this.loadActor(actorId);
    const { data, total } = await this.users.list({
      scope: scopeOf(actor.reach),
      active: query.active,
      tenantId: query.tenantId,
      search: query.search,
      page: query.page ?? 1,
      limit: query.limit ?? DEFAULT_PAGE_SIZE,
    });
    return { data: data.map(toUserResponse), total };
  }

  async findOne(id: string, actorId: string): Promise<UserResponseDto> {
    const actor = await this.loadActor(actorId);
    return toUserResponse(await this.findInScope(id, actor));
  }

  async create(dto: CreateUserDto, actorId: string): Promise<UserResponseDto> {
    const actor = await this.loadActor(actorId);
    const tenantIds = dto.tenantIds ?? [];
    const profileIds = dto.profileIds ?? [];
    if (!actor.reach.superAdmin && tenantIds.length === 0) {
      throw new BadRequestException({
        code: ERROR_CODES.TENANT_REQUIRED,
        message: 'Informe ao menos um tenant para o usuário.',
      });
    }
    assertTenantsGrantable(actor.reach, [], tenantIds);
    await this.assertTenantsExist(tenantIds);
    await this.assertProfilesGrantable(actor, profileIds);
    const email = normalizeEmail(dto.email);
    await this.assertEmailAvailable(email);
    const passwordHash = await argon2.hash(dto.password);

    const id = await this.withEmailConflict(() =>
      this.users.create({
        name: dto.name.trim(),
        email,
        passwordHash,
        active: dto.active ?? true,
        createdById: actorId,
        profileIds,
        tenantIds,
      }),
    );
    return toUserResponse(await this.findExisting(id));
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actorId: string,
  ): Promise<UserResponseDto> {
    const actor = await this.loadActor(actorId);
    const target = await this.findInScope(id, actor);
    assertCanModify(actor, target);
    if (dto.active === false) assertCanDisable(actor, target);

    const email = dto.email ? normalizeEmail(dto.email) : undefined;
    if (email && email !== target.email) {
      await this.assertEmailAvailable(email, id);
    }
    if (dto.profileIds) {
      const current = target.profiles.map((profile) => profile.id);
      await this.assertProfilesGrantable(
        actor,
        changedIds(current, dto.profileIds),
      );
    }

    await this.withEmailConflict(() =>
      this.users.update(id, {
        name: dto.name?.trim(),
        email,
        active: dto.active,
        updatedById: actorId,
        profileIds: dto.profileIds,
      }),
    );
    return this.findOne(id, actorId);
  }

  async assignTenants(
    id: string,
    dto: AssignUserTenantsDto,
    actorId: string,
  ): Promise<UserResponseDto> {
    const actor = await this.loadActor(actorId);
    const target = await this.findInScope(id, actor);
    assertCanModify(actor, target);
    const current = target.tenants.map((tenant) => tenant.id);
    const next = mergeTenantAssignment(actor.reach, current, dto.tenantIds);
    assertTenantsGrantable(actor.reach, current, next);
    await this.assertTenantsExist(changedIds(current, next));

    await this.users.replaceTenants(id, next, actorId);
    return this.findOne(id, actorId);
  }

  async resetPassword(
    id: string,
    dto: ResetUserPasswordDto,
    actorId: string,
  ): Promise<void> {
    const actor = await this.loadActor(actorId);
    const target = await this.findInScope(id, actor);
    assertCanModify(actor, target);
    if (!target.active) {
      throw new ConflictException({
        code: ERROR_CODES.USER_INACTIVE,
        message: 'Reative o usuário antes de redefinir a senha.',
      });
    }
    await this.users.updatePassword(id, {
      passwordHash: await argon2.hash(dto.password),
      mustChangePassword: true,
      updatedById: actorId,
    });
  }

  async setActive(
    id: string,
    active: boolean,
    actorId: string,
  ): Promise<UserResponseDto> {
    return this.update(id, { active }, actorId);
  }

  /**
   * Exclusão lógica: `deletedAt` + inativação. O e-mail segue reservado (o
   * unique do banco não distingue excluídos).
   */
  async remove(id: string, actorId: string): Promise<void> {
    const actor = await this.loadActor(actorId);
    const target = await this.findInScope(id, actor);
    assertCanDisable(actor, target);
    await this.users.softDelete(id, actorId);
  }

  // ---------------------------------------------------------------------------

  private async loadActor(actorId: string): Promise<UserActor> {
    const [reach, permissions] = await Promise.all([
      this.tenantAccess.reachOf(actorId),
      this.permissions.load(actorId),
    ]);
    if (!reach || !permissions) {
      throw new UnauthorizedException('Sessão inválida.');
    }
    return { id: actorId, reach, permissions };
  }

  /** Usuário não excluído e no alcance do ator; fora disso, 404 indistinto. */
  private async findInScope(
    id: string,
    actor: UserActor,
  ): Promise<UserAggregate> {
    const user = await this.users.findInScope(id, scopeOf(actor.reach));
    if (!user) throw userNotFound();
    return user;
  }

  /** Recém-criado: lê sem filtro de alcance (o ator acabou de vinculá-lo). */
  private async findExisting(id: string): Promise<UserAggregate> {
    const user = await this.users.findById(id);
    if (!user) throw userNotFound();
    return user;
  }

  /** Perfis existentes e ativos; permissões deles concedíveis pelo ator. */
  private async assertProfilesGrantable(
    actor: UserActor,
    profileIds: string[],
  ): Promise<void> {
    if (profileIds.length === 0) return;
    const profiles = await this.profiles.findActiveByIds(profileIds);
    if (profiles.length !== profileIds.length) {
      throw new BadRequestException({
        code: ERROR_CODES.PROFILE_NOT_FOUND,
        message: 'Um ou mais perfis informados não existem.',
      });
    }
    assertPermissionsGrantable(
      actor.permissions,
      profiles.flatMap((profile) => profile.permissionKeys),
    );
  }

  private async assertTenantsExist(tenantIds: string[]): Promise<void> {
    if (tenantIds.length === 0) return;
    const found = await this.tenants.countExisting(tenantIds);
    if (found === tenantIds.length) return;
    throw new BadRequestException({
      code: ERROR_CODES.TENANT_NOT_FOUND,
      message: 'Um ou mais tenants informados não existem.',
    });
  }

  /** Resposta NEUTRA: não revela se o e-mail é de alguém fora do alcance. */
  private async assertEmailAvailable(
    email: string,
    exceptId?: string,
  ): Promise<void> {
    const existingId = await this.users.findIdByEmail(email);
    if (existingId && existingId !== exceptId) throw emailUnavailable();
  }

  /** Corrida entre a checagem e a escrita: o unique do banco decide. */
  private async withEmailConflict<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (isMysqlDuplicateEntry(error)) throw emailUnavailable();
      throw error;
    }
  }
}

function userNotFound(): NotFoundException {
  return new NotFoundException({
    code: ERROR_CODES.USER_NOT_FOUND,
    message: 'Usuário não encontrado.',
  });
}

function emailUnavailable(): ConflictException {
  return new ConflictException({
    code: ERROR_CODES.EMAIL_UNAVAILABLE,
    message: 'Este e-mail não está disponível.',
  });
}
