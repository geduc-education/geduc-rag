import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-any-permission.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions';
import {
  CreateTenantDto,
  TenantResponseDto,
  UpdateTenantDto,
} from './dto/tenant.dto';
import { TenantsService } from './tenants.service';

@ApiTags('tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /** `user:manage` também lê: o form de usuário precisa das opções. */
  @Get()
  @RequireAnyPermission(PERMISSIONS.TENANT_READ, PERMISSIONS.USER_MANAGE)
  @ApiResponse({ status: 200, type: [TenantResponseDto] })
  list(@CurrentUser('id') actorId: string): Promise<TenantResponseDto[]> {
    return this.tenantsService.list(actorId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.TENANT_READ)
  @ApiResponse({ status: 200, type: TenantResponseDto })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') actorId: string,
  ): Promise<TenantResponseDto> {
    return this.tenantsService.findOne(id, actorId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.TENANT_MANAGE)
  @ApiResponse({ status: 201, type: TenantResponseDto })
  create(
    @Body() dto: CreateTenantDto,
    @CurrentUser('id') actorId: string,
  ): Promise<TenantResponseDto> {
    return this.tenantsService.create(dto, actorId);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.TENANT_MANAGE)
  @ApiResponse({ status: 200, type: TenantResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
    @CurrentUser('id') actorId: string,
  ): Promise<TenantResponseDto> {
    return this.tenantsService.update(id, dto, actorId);
  }
}
