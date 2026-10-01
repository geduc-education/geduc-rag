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
  CreateEmployeeDto,
  EmployeeListResponseDto,
  EmployeeResponseDto,
  ListEmployeesDto,
  UpdateEmployeeDto,
} from './dto/employee.dto';
import { EmployeesService } from './employees.service';

/**
 * Rotas (autenticação global + `tenant-id` validado pelo `TenantGuard`):
 *   GET    /employees               — lista paginada do tenant
 *   GET    /employees/:id           — detalhe
 *   POST   /employees               — cria
 *   PATCH  /employees/:id           — edita
 *   DELETE /employees/:id           — exclusão lógica
 *   DELETE /employees/:id/permanent — exclusão definitiva (`employee:purge`)
 */
@ApiTags('employees')
@ApiBearerAuth()
@TenantScoped()
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiResponse({ status: 200, type: EmployeeListResponseDto })
  list(
    @TenantId() tenantId: string,
    @Query() query: ListEmployeesDto,
  ): Promise<EmployeeListResponseDto> {
    return this.employeesService.list(tenantId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_READ)
  @ApiResponse({ status: 200, type: EmployeeResponseDto })
  findOne(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EmployeeResponseDto> {
    return this.employeesService.findOne(tenantId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 201, type: EmployeeResponseDto })
  create(
    @TenantId() tenantId: string,
    @Body() dto: CreateEmployeeDto,
    @CurrentUser('id') actorId: string,
  ): Promise<EmployeeResponseDto> {
    return this.employeesService.create(tenantId, dto, actorId);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 200, type: EmployeeResponseDto })
  update(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser('id') actorId: string,
  ): Promise<EmployeeResponseDto> {
    return this.employeesService.update(tenantId, id, dto, actorId);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiNoContentResponse({ description: 'Excluído logicamente.' })
  remove(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') actorId: string,
  ): Promise<void> {
    return this.employeesService.remove(tenantId, id, actorId);
  }

  @Delete(':id/permanent')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.EMPLOYEE_PURGE)
  @ApiNoContentResponse({ description: 'Removido definitivamente.' })
  purge(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.employeesService.purge(tenantId, id);
  }
}
