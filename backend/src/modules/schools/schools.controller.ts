import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions';
import {
  TenantId,
  TenantScoped,
} from '../../common/tenancy/tenant-scoped.decorator';
import {
  CreateSchoolDto,
  ListSchoolsDto,
  SchoolListResponseDto,
  SchoolResponseDto,
  UpdateSchoolDto,
} from './dto/school.dto';
import { SchoolsService } from './schools.service';

/**
 * Rotas (autenticação global + `tenant-id` validado pelo `TenantGuard`),
 * todas com `employee:manage`, leitura inclusive:
 *   GET    /schools     — lista paginada do tenant
 *   GET    /schools/:id — detalhe
 *   POST   /schools     — cria
 *   PATCH  /schools/:id — edita
 *   DELETE /schools/:id — exclusão lógica
 */
@ApiTags('schools')
@ApiBearerAuth()
@TenantScoped()
@Controller('schools')
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 200, type: SchoolListResponseDto })
  list(
    @TenantId() tenantId: string,
    @Query() query: ListSchoolsDto,
  ): Promise<SchoolListResponseDto> {
    return this.schoolsService.list(tenantId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 200, type: SchoolResponseDto })
  findOne(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SchoolResponseDto> {
    return this.schoolsService.findOne(tenantId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 201, type: SchoolResponseDto })
  create(
    @TenantId() tenantId: string,
    @Body() dto: CreateSchoolDto,
    @CurrentUser('id') actorId: string,
  ): Promise<SchoolResponseDto> {
    return this.schoolsService.create(tenantId, dto, actorId);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 200, type: SchoolResponseDto })
  update(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSchoolDto,
    @CurrentUser('id') actorId: string,
  ): Promise<SchoolResponseDto> {
    return this.schoolsService.update(tenantId, id, dto, actorId);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiNoContentResponse({ description: 'Excluída logicamente.' })
  remove(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') actorId: string,
  ): Promise<void> {
    return this.schoolsService.remove(tenantId, id, actorId);
  }
}
