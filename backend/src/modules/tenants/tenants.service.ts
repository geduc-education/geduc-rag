import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { isMysqlDuplicateEntry } from '../../@core/shared/exceptions/400/duplicate-entry';
import { ERROR_CODES } from '../../common/errors/error-codes';
import {
  scopeOf,
  TenantAccessService,
  type TenantReach,
} from '../../common/tenancy/tenant-access.service';
import {
  type ITenantRepository,
  TENANT_REPOSITORY,
} from './application/interface/repository/tenant.repository.interface';
import {
  CreateTenantDto,
  TenantResponseDto,
  UpdateTenantDto,
} from './dto/tenant.dto';

/**
 * Cadastro de tenants. Leitura e edição ficam no alcance do ator (vínculos
 * `UserTenant`; SUPERADMIN vê todos). Quem cria um tenant nasce vinculado a
 * ele — senão o criador perderia o acesso ao que acabou de criar.
 */
@Injectable()
export class TenantsService {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly repository: ITenantRepository,
    private readonly tenantAccess: TenantAccessService,
  ) {}

  async list(actorId: string): Promise<TenantResponseDto[]> {
    const reach = await this.reachOf(actorId);
    return this.repository.list(scopeOf(reach));
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
      this.repository.create({
        name: dto.name.trim(),
        slug: dto.slug,
        active: dto.active ?? true,
        createdById: actorId,
        linkUserId: reach.superAdmin ? null : actorId,
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
      this.repository.update(id, {
        name: dto.name?.trim(),
        slug: dto.slug,
        active: dto.active,
        updatedById: actorId,
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
    const tenant = inReach ? await this.repository.findById(id) : null;
    if (!tenant) throw new NotFoundException('Tenant não encontrado.');
    return tenant;
  }

  private async withSlugConflict<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (isMysqlDuplicateEntry(error)) {
        throw new ConflictException({
          code: ERROR_CODES.TENANT_SLUG_TAKEN,
          message: 'Este slug já está em uso.',
        });
      }
      throw error;
    }
  }
}
