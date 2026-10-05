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
  CreateLessonSlotDto,
  LessonSlotListResponseDto,
  LessonSlotResponseDto,
  UpdateLessonSlotDto,
} from './dto/school-lesson-slot.dto';
import { SchoolLessonSlotsService } from './school-lesson-slots.service';

/**
 * Horários de aula da escola (autenticação global + `tenant-id` validado
 * pelo `TenantGuard`), todas com `employee:manage`, leitura inclusive:
 *   GET    /schools/:schoolId/lesson-slots     — lista ordenada
 *   POST   /schools/:schoolId/lesson-slots     — cria
 *   PATCH  /schools/:schoolId/lesson-slots/:id — edita
 *   DELETE /schools/:schoolId/lesson-slots/:id — exclusão lógica
 */
@ApiTags('schools')
@ApiBearerAuth()
@TenantScoped()
@Controller('schools/:schoolId/lesson-slots')
export class SchoolLessonSlotsController {
  constructor(private readonly service: SchoolLessonSlotsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 200, type: LessonSlotListResponseDto })
  list(
    @TenantId() tenantId: string,
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
  ): Promise<LessonSlotListResponseDto> {
    return this.service.list(tenantId, schoolId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 201, type: LessonSlotResponseDto })
  create(
    @TenantId() tenantId: string,
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Body() dto: CreateLessonSlotDto,
    @CurrentUser('id') actorId: string,
  ): Promise<LessonSlotResponseDto> {
    return this.service.create(tenantId, schoolId, dto, actorId);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 200, type: LessonSlotResponseDto })
  update(
    @TenantId() tenantId: string,
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLessonSlotDto,
    @CurrentUser('id') actorId: string,
  ): Promise<LessonSlotResponseDto> {
    return this.service.update(tenantId, schoolId, id, dto, actorId);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiNoContentResponse({ description: 'Excluído logicamente.' })
  remove(
    @TenantId() tenantId: string,
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') actorId: string,
  ): Promise<void> {
    return this.service.remove(tenantId, schoolId, id, actorId);
  }
}
