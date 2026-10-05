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
  CreateSubjectDto,
  ListSubjectsDto,
  SubjectListResponseDto,
  SubjectResponseDto,
  UpdateSubjectDto,
} from './dto/subject.dto';
import { SubjectsService } from './subjects.service';

/**
 * Rotas (autenticação global + `tenant-id` validado pelo `TenantGuard`),
 * todas com `employee:manage`, leitura inclusive:
 *   GET    /subjects     — lista paginada do tenant
 *   GET    /subjects/:id — detalhe
 *   POST   /subjects     — cria
 *   PATCH  /subjects/:id — edita
 *   DELETE /subjects/:id — exclusão lógica
 */
@ApiTags('subjects')
@ApiBearerAuth()
@TenantScoped()
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 200, type: SubjectListResponseDto })
  list(
    @TenantId() tenantId: string,
    @Query() query: ListSubjectsDto,
  ): Promise<SubjectListResponseDto> {
    return this.subjectsService.list(tenantId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 200, type: SubjectResponseDto })
  findOne(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SubjectResponseDto> {
    return this.subjectsService.findOne(tenantId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 201, type: SubjectResponseDto })
  create(
    @TenantId() tenantId: string,
    @Body() dto: CreateSubjectDto,
    @CurrentUser('id') actorId: string,
  ): Promise<SubjectResponseDto> {
    return this.subjectsService.create(tenantId, dto, actorId);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 200, type: SubjectResponseDto })
  update(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubjectDto,
    @CurrentUser('id') actorId: string,
  ): Promise<SubjectResponseDto> {
    return this.subjectsService.update(tenantId, id, dto, actorId);
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
    return this.subjectsService.remove(tenantId, id, actorId);
  }
}
