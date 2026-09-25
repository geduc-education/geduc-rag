import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { EffectivePermissionsService } from '../../common/rbac/effective-permissions.service';
import { TenantAccessService } from '../../common/tenancy/tenant-access.service';
import { PrismaService } from '../../database/prisma.service';
import { AssignUserTenantsDto } from './dto/assign-user-tenants.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserListResponseDto, UserResponseDto } from './dto/user-response.dto';
import {
  assertCanDisable,
  assertCanModify,
  assertPermissionsGrantable,
  assertTenantsGrantable,
  changedIds,
  mergeTenantAssignment,
  normalizeEmail,
  UserActor,
  userScopeWhere,
} from './users.policy';
import { toUserResponse, USER_SELECT, UserWithRelations } from './users.select';

const DEFAULT_PAGE_SIZE = 20;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: EffectivePermissionsService,
    private readonly tenantAccess: TenantAccessService,
  ) {}

  async list(
    query: ListUsersDto,
    actorId: string,
  ): Promise<UserListResponseDto> {
    const actor = await this.loadActor(actorId);
    const where: Prisma.UserWhereInput = {
      AND: [
        { deletedAt: null },
        userScopeWhere(actor.reach),
        this.listFilters(query),
      ],
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data: rows.map(toUserResponse), total };
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

    const user = await this.withEmailConflict(() =>
      this.prisma.user.create({
        data: {
          name: dto.name.trim(),
          email,
          passwordHash,
          active: dto.active ?? true,
          mustChangePassword: true,
          createdById: actorId,
          profiles: {
            create: profileIds.map((profileId) => ({
              profileId,
              assignedById: actorId,
            })),
          },
          tenants: { create: tenantIds.map((tenantId) => ({ tenantId })) },
        },
        select: USER_SELECT,
      }),
    );
    return toUserResponse(user);
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
      const current = target.profiles.map(({ profile }) => profile.id);
      await this.assertProfilesGrantable(
        actor,
        changedIds(current, dto.profileIds),
      );
    }

    await this.withEmailConflict(() =>
      this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id },
          data: {
            name: dto.name?.trim(),
            email,
            active: dto.active,
            updatedById: actorId,
          },
        });
        if (dto.profileIds) {
          await this.replaceProfiles(tx, id, dto.profileIds, actorId);
        }
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
    const current = target.tenants.map(({ tenant }) => tenant.id);
    const next = mergeTenantAssignment(actor.reach, current, dto.tenantIds);
    assertTenantsGrantable(actor.reach, current, next);
    await this.assertTenantsExist(changedIds(current, next));

    await this.prisma.$transaction([
      this.prisma.userTenant.deleteMany({
        where: { userId: id, tenantId: { notIn: next } },
      }),
      this.prisma.userTenant.createMany({
        data: next.map((tenantId) => ({ userId: id, tenantId })),
        skipDuplicates: true,
      }),
      this.prisma.user.update({
        where: { id },
        data: { updatedById: actorId },
      }),
    ]);
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
    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: await argon2.hash(dto.password),
        mustChangePassword: true,
        updatedById: actorId,
      },
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
    await this.prisma.user.update({
      where: { id },
      data: { active: false, deletedAt: new Date(), deletedById: actorId },
    });
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
  ): Promise<UserWithRelations> {
    const user = await this.prisma.user.findFirst({
      where: { AND: [{ id, deletedAt: null }, userScopeWhere(actor.reach)] },
      select: USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException({
        code: ERROR_CODES.USER_NOT_FOUND,
        message: 'Usuário não encontrado.',
      });
    }
    return user;
  }

  private listFilters(query: ListUsersDto): Prisma.UserWhereInput {
    const search = query.search?.trim();
    return {
      ...(query.active !== undefined ? { active: query.active } : {}),
      ...(query.tenantId
        ? { tenants: { some: { tenantId: query.tenantId } } }
        : {}),
      ...(search
        ? {
            OR: [
              // Case-insensitive pela collation das tabelas (utf8mb4_unicode_ci).
              { name: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : {}),
    };
  }

  /** Perfis existentes e ativos; permissões deles concedíveis pelo ator. */
  private async assertProfilesGrantable(
    actor: UserActor,
    profileIds: string[],
  ): Promise<void> {
    if (profileIds.length === 0) return;
    const profiles = await this.prisma.profile.findMany({
      where: { id: { in: profileIds }, active: true, deletedAt: null },
      select: {
        permissions: { select: { permission: { select: { key: true } } } },
      },
    });
    if (profiles.length !== profileIds.length) {
      throw new BadRequestException({
        code: ERROR_CODES.PROFILE_NOT_FOUND,
        message: 'Um ou mais perfis informados não existem.',
      });
    }
    assertPermissionsGrantable(
      actor.permissions,
      profiles.flatMap((p) => p.permissions.map((g) => g.permission.key)),
    );
  }

  private async assertTenantsExist(tenantIds: string[]): Promise<void> {
    if (tenantIds.length === 0) return;
    const found = await this.prisma.tenant.count({
      where: { id: { in: tenantIds }, deletedAt: null },
    });
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
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing && existing.id !== exceptId) throw emailUnavailable();
  }

  /** Corrida entre a checagem e a escrita: o unique do banco decide (P2002). */
  private async withEmailConflict<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw emailUnavailable();
      }
      throw error;
    }
  }

  private async replaceProfiles(
    tx: Prisma.TransactionClient,
    userId: string,
    profileIds: string[],
    actorId: string,
  ): Promise<void> {
    await tx.userProfile.deleteMany({
      where: { userId, profileId: { notIn: profileIds } },
    });
    await tx.userProfile.createMany({
      data: profileIds.map((profileId) => ({
        userId,
        profileId,
        assignedById: actorId,
      })),
      skipDuplicates: true,
    });
  }
}

function emailUnavailable(): ConflictException {
  return new ConflictException({
    code: ERROR_CODES.EMAIL_UNAVAILABLE,
    message: 'Este e-mail não está disponível.',
  });
}
