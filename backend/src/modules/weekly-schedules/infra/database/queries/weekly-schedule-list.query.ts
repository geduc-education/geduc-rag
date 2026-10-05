import {
  addEq,
  addRaw,
  createFilterContext,
} from '../../../../../@core/infra/database/query-builder/filters';
import {
  buildPagedSelect,
  PagedQuery,
} from '../../../../../@core/infra/database/query-builder/paged-select';
import type { WeeklyScheduleListFilter } from '../../../application/interface/repository/weekly-schedule.repository.interface';

/**
 * Situação do horário: `OUTDATED` quando algum dia com calendário gravado
 * diverge do dia atual do mesmo calendário (ou o calendário foi excluído).
 */
export const SCHEDULE_STATUS_SQL = `CASE WHEN EXISTS (
    SELECT 1
      FROM weekly_schedule_day wd
      LEFT JOIN academic_calendar c ON c.id = wd.calendar_id AND c.deleted_at IS NULL
      LEFT JOIN academic_calendar_day cd ON cd.calendar_id = c.id AND cd.day_date = wd.day_date
     WHERE wd.schedule_id = ws.id AND wd.calendar_id IS NOT NULL
       AND (cd.day_type IS NULL OR cd.day_type <> wd.day_type)
  ) THEN 'OUTDATED' ELSE 'UP_TO_DATE' END`;

/** Agregado das aulas do horário (subquery correlata, sem N+1). */
function lessonAggregate(expression: string): string {
  return `(SELECT COALESCE(${expression}, 0)
      FROM weekly_schedule_lesson l
      JOIN weekly_schedule_day wd ON wd.id = l.schedule_day_id
     WHERE wd.schedule_id = ws.id)`;
}

/** `DATE` sai como texto: o adapter usa `dateStrings: false` e sessão UTC. */
export const WEEKLY_SCHEDULE_COLUMNS = [
  'ws.id',
  'ws.tenant_id',
  'ws.school_class_id',
  "DATE_FORMAT(ws.start_date, '%Y-%m-%d') AS start_date",
  "DATE_FORMAT(ws.end_date, '%Y-%m-%d') AS end_date",
  `${SCHEDULE_STATUS_SQL} AS status`,
  `${lessonAggregate('COUNT(*)')} AS lesson_count`,
  `${lessonAggregate('SUM(l.content_recorded)')} AS content_recorded_count`,
  `${lessonAggregate('SUM(l.attendance_recorded)')} AS attendance_recorded_count`,
  'ws.created_at',
  'ws.updated_at',
].join(',\n  ');

export const WEEKLY_SCHEDULE_FROM = 'weekly_schedule ws';

const ORDER_BY = 'ws.start_date DESC, ws.id ASC';

/** Página e contagem dos horários não excluídos do tenant. */
export function buildWeeklyScheduleListQuery(
  filter: WeeklyScheduleListFilter,
): PagedQuery {
  const ctx = createFilterContext();
  addRaw(ctx, 'ws.tenant_id = :tenantId', { tenantId: filter.tenantId });
  addRaw(ctx, 'ws.deleted_at IS NULL');
  addEq(ctx, 'ws.school_class_id', 'schoolClassId', filter.schoolClassId);
  if (filter.from !== undefined) {
    addRaw(ctx, 'ws.end_date >= :from', { from: filter.from });
  }
  if (filter.to !== undefined) {
    addRaw(ctx, 'ws.start_date <= :to', { to: filter.to });
  }
  return buildPagedSelect({
    select: WEEKLY_SCHEDULE_COLUMNS,
    from: WEEKLY_SCHEDULE_FROM,
    ctx,
    orderBy: ORDER_BY,
    allowedOrderBy: [ORDER_BY],
    page: { page: filter.page, limit: filter.limit },
  });
}
