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
  CreateSchoolClassDto,
  ListSchoolClassesDto,
  SchoolClassListResponseDto,
  SchoolClassResponseDto,
  UpdateSchoolClassDto,
} from './dto/school-class.dto';
import { SchoolClassesService } from './school-classes.service';

/**
 * Rotas (autenticação global + `tenant-id` validado pelo `TenantGuard`),
 * todas com `employee:manage`, leitura inclusive:
 *   GET    /school-classes     — lista paginada do tenant
 *   GET    /school-classes/:id — detalhe
 *   POST   /school-classes     — cria
 *   PATCH  /school-classes/:id — edita nome e situação
 *   DELETE /school-classes/:id — exclusão lógica
 */
@ApiTags('school-classes')
@ApiBearerAuth()
@TenantScoped()
@Controller('school-classes')
export class SchoolClassesController {
  constructor(private readonly schoolClassesService: SchoolClassesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 200, type: SchoolClassListResponseDto })
  list(
    @TenantId() tenantId: string,
    @Query() query: ListSchoolClassesDto,
  ): Promise<SchoolClassListResponseDto> {
    return this.schoolClassesService.list(tenantId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 200, type: SchoolClassResponseDto })
  findOne(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SchoolClassResponseDto> {
    return this.schoolClassesService.findOne(tenantId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 201, type: SchoolClassResponseDto })
  create(
    @TenantId() tenantId: string,
    @Body() dto: CreateSchoolClassDto,
    @CurrentUser('id') actorId: string,
  ): Promise<SchoolClassResponseDto> {
    return this.schoolClassesService.create(tenantId, dto, actorId);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 200, type: SchoolClassResponseDto })
  update(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSchoolClassDto,
    @CurrentUser('id') actorId: string,
  ): Promise<SchoolClassResponseDto> {
    return this.schoolClassesService.update(tenantId, id, dto, actorId);
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
    return this.schoolClassesService.remove(tenantId, id, actorId);
  }
}
