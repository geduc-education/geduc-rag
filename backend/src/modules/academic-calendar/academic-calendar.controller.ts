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
import { AcademicCalendarService } from './academic-calendar.service';
import {
  AcademicCalendarDetailResponseDto,
  AcademicCalendarListResponseDto,
  CalendarDayParamsDto,
  CalendarDayResponseDto,
  CalendarDaysQueryDto,
  CalendarDaysResponseDto,
  CreateAcademicCalendarDto,
  ListAcademicCalendarsDto,
  UpdateAcademicCalendarDto,
  UpdateCalendarDayDto,
} from './dto/academic-calendar.dto';

/**
 * Rotas (autenticação global + `tenant-id` validado pelo `TenantGuard`), todas
 * com `employee:manage` — quem cadastra funcionários gere o calendário:
 *   GET    /academic-calendars                 — lista paginada do tenant
 *   GET    /academic-calendars/:id             — detalhe com quantitativos
 *   POST   /academic-calendars                 — cria com os dias do período
 *   PATCH  /academic-calendars/:id             — edita nome e escolas
 *   DELETE /academic-calendars/:id             — exclusão lógica
 *   GET    /academic-calendars/:id/days        — visão dia/semana/mês/ano
 *   PATCH  /academic-calendars/:id/days/:date  — edita tipo/descrição do dia
 */
@ApiTags('academic-calendars')
@ApiBearerAuth()
@TenantScoped()
@Controller('academic-calendars')
export class AcademicCalendarController {
  constructor(private readonly service: AcademicCalendarService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 200, type: AcademicCalendarListResponseDto })
  list(
    @TenantId() tenantId: string,
    @Query() query: ListAcademicCalendarsDto,
  ): Promise<AcademicCalendarListResponseDto> {
    return this.service.list(tenantId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 200, type: AcademicCalendarDetailResponseDto })
  findOne(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AcademicCalendarDetailResponseDto> {
    return this.service.findOne(tenantId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 201, type: AcademicCalendarDetailResponseDto })
  create(
    @TenantId() tenantId: string,
    @Body() dto: CreateAcademicCalendarDto,
    @CurrentUser('id') actorId: string,
  ): Promise<AcademicCalendarDetailResponseDto> {
    return this.service.create(tenantId, dto, actorId);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 200, type: AcademicCalendarDetailResponseDto })
  update(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAcademicCalendarDto,
    @CurrentUser('id') actorId: string,
  ): Promise<AcademicCalendarDetailResponseDto> {
    return this.service.update(tenantId, id, dto, actorId);
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
    return this.service.remove(tenantId, id, actorId);
  }

  @Get(':id/days')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 200, type: CalendarDaysResponseDto })
  listDays(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CalendarDaysQueryDto,
  ): Promise<CalendarDaysResponseDto> {
    return this.service.listDays(tenantId, id, query);
  }

  @Patch(':id/days/:date')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  @ApiResponse({ status: 200, type: CalendarDayResponseDto })
  updateDay(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param() params: CalendarDayParamsDto,
    @Body() dto: UpdateCalendarDayDto,
    @CurrentUser('id') actorId: string,
  ): Promise<CalendarDayResponseDto> {
    return this.service.updateDay(tenantId, id, params.date, dto, actorId);
  }
}
