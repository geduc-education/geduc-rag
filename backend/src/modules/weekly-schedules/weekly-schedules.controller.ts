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
  Put,
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
  CreateWeeklyScheduleDto,
  ListWeeklySchedulesDto,
  ReplicateWeeklyScheduleDto,
  ReplicationResponseDto,
  ScheduleLessonResponseDto,
  UpdateLessonRecordDto,
  UpdateWeeklyScheduleDto,
  WeeklyScheduleListResponseDto,
  WeeklyScheduleResponseDto,
} from './dto/weekly-schedule.dto';
import { WeeklySchedulesService } from './weekly-schedules.service';

/**
 * Rotas (autenticação global + `tenant-id` validado pelo `TenantGuard`), todas
 * com `employee:manage`, como o calendário acadêmico:
 *   GET    /weekly-schedules                              — lista paginada
 *   GET    /weekly-schedules/:id                          — detalhe com dias e aulas
 *   POST   /weekly-schedules                              — cria a semana da turma
 *   PUT    /weekly-schedules/:id                          — substitui os dias
 *   DELETE /weekly-schedules/:id                          — exclusão lógica
 *   POST   /weekly-schedules/:id/replicate                — replica para outras semanas
 *   PATCH  /weekly-schedules/:id/lessons/:lessonId/record — registro da aula
 */
@ApiTags('weekly-schedules')
@ApiBearerAuth()
@TenantScoped()
@Controller('weekly-schedules')
export class WeeklySchedulesController {
  constructor(private readonly service: WeeklySchedulesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 200, type: WeeklyScheduleListResponseDto })
  list(
    @TenantId() tenantId: string,
    @Query() query: ListWeeklySchedulesDto,
  ): Promise<WeeklyScheduleListResponseDto> {
    return this.service.list(tenantId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 200, type: WeeklyScheduleResponseDto })
  @ApiResponse({ status: 404, description: 'SCHEDULE_NOT_FOUND' })
  findOne(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WeeklyScheduleResponseDto> {
    return this.service.findOne(tenantId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 201, type: WeeklyScheduleResponseDto })
  @ApiResponse({ status: 409, description: 'SCHEDULE_WEEK_TAKEN' })
  create(
    @TenantId() tenantId: string,
    @Body() dto: CreateWeeklyScheduleDto,
    @CurrentUser('id') actorId: string,
  ): Promise<WeeklyScheduleResponseDto> {
    return this.service.create(tenantId, dto, actorId);
  }

  @Put(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 200, type: WeeklyScheduleResponseDto })
  @ApiResponse({ status: 409, description: 'SCHEDULE_HAS_RECORDS' })
  update(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWeeklyScheduleDto,
    @CurrentUser('id') actorId: string,
  ): Promise<WeeklyScheduleResponseDto> {
    return this.service.update(tenantId, id, dto, actorId);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiNoContentResponse({ description: 'Excluído logicamente.' })
  @ApiResponse({ status: 409, description: 'SCHEDULE_HAS_RECORDS' })
  remove(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') actorId: string,
  ): Promise<void> {
    return this.service.remove(tenantId, id, actorId);
  }

  @Post(':id/replicate')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 201, type: ReplicationResponseDto })
  replicate(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplicateWeeklyScheduleDto,
    @CurrentUser('id') actorId: string,
  ): Promise<ReplicationResponseDto> {
    return this.service.replicate(tenantId, id, dto, actorId);
  }

  @Patch(':id/lessons/:lessonId/record')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 200, type: ScheduleLessonResponseDto })
  @ApiResponse({ status: 404, description: 'SCHEDULE_LESSON_NOT_FOUND' })
  updateLessonRecord(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() dto: UpdateLessonRecordDto,
    @CurrentUser('id') actorId: string,
  ): Promise<ScheduleLessonResponseDto> {
    return this.service.updateLessonRecord(
      tenantId,
      id,
      lessonId,
      dto,
      actorId,
    );
  }
}
