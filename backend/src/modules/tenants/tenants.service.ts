import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ERROR_CODES } from '../../common/errors/error-codes';
import {
  TenantAccessService,
  TenantReach,
} from '../../common/tenancy/tenant-access.service';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateTenantDto,
  TenantResponseDto,
  UpdateTenantDto,
} from './dto/tenant.dto';

const TENANT_SELECT = {
  id: true,
  name: true,
  slug: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TenantSelect;

/**
 * Cadastro de tenants. Leitura e edição ficam no alcance do ator (vínculos
 * `UserTenant`; SUPERADMIN vê todos). Quem cria um tenant nasce vinculado a
 * ele — senão o criador perderia o acesso ao que acabou de criar.
 */
@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantAccess: TenantAccessService,
  ) {}

  async list(actorId: string): Promise<TenantResponseDto[]> {
    const reach = await this.reachOf(actorId);
    return this.prisma.tenant.findMany({
      where: { deletedAt: null, ...this.tenantAccess.tenantWhere(reach) },
      orderBy: { name: 'asc' },
      select: TENANT_SELECT,
    });
  }

  async findOne(id: string, actorId: string): Promise<TenantResponseDto> {
    const reach = await this.reachOf(actorId);
    return this.findInScope(id, reach);
  }

  async create(
    dto: CreateTenantDto,
    actorId: string,
  ): Promise<TenantResponseDto> {
    const reach = await this.reachOf(actorId);
    return this.withSlugConflict(() =>
      this.prisma.tenant.create({
        data: {
          name: dto.name.trim(),
          slug: dto.slug,
          active: dto.active ?? true,
          createdById: actorId,
          ...(reach.superAdmin
            ? {}
            : { users: { create: { userId: actorId } } }),
        },
        select: TENANT_SELECT,
      }),
    );
  }

  async update(
    id: string,
    dto: UpdateTenantDto,
    actorId: string,
  ): Promise<TenantResponseDto> {
    const reach = await this.reachOf(actorId);
    await this.findInScope(id, reach);
    return this.withSlugConflict(() =>
      this.prisma.tenant.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          slug: dto.slug,
          active: dto.active,
          updatedById: actorId,
        },
        select: TENANT_SELECT,
      }),
    );
  }

  private async reachOf(actorId: string): Promise<TenantReach> {
    const reach = await this.tenantAccess.reachOf(actorId);
    if (!reach) throw new UnauthorizedException('Sessão inválida.');
    return reach;
  }

  private async findInScope(
    id: string,
    reach: TenantReach,
  ): Promise<TenantResponseDto> {
    const inReach = reach.tenantIds === null || reach.tenantIds.includes(id);
    const tenant = inReach
      ? await this.prisma.tenant.findFirst({
          where: { id, deletedAt: null },
          select: TENANT_SELECT,
        })
      : null;
    if (!tenant) throw new NotFoundException('Tenant não encontrado.');
    return tenant;
  }

  private async withSlugConflict<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: ERROR_CODES.TENANT_SLUG_TAKEN,
          message: 'Este slug já está em uso.',
        });
      }
      throw error;
    }
  }
}
