import {
  addEq,
  addRaw,
  createFilterContext,
} from '../../../../../@core/infra/database/query-builder/filters';
import {
  buildPagedSelect,
  PagedQuery,
} from '../../../../../@core/infra/database/query-builder/paged-select';
import type { AcademicCalendarListFilter } from '../../../application/interface/repository/academic-calendar.repository.interface';

/** `DATE` sai como texto: o adapter usa `dateStrings: false` e sessão UTC. */
export const ACADEMIC_CALENDAR_COLUMNS = [
  'c.id',
  'c.tenant_id',
  'c.school_year',
  'c.name',
  "DATE_FORMAT(c.start_date, '%Y-%m-%d') AS start_date",
  "DATE_FORMAT(c.end_date, '%Y-%m-%d') AS end_date",
  'c.all_schools',
  'c.created_at',
  'c.updated_at',
].join(', ');

export const ACADEMIC_CALENDAR_FROM = 'academic_calendar c';

const ORDER_BY = 'c.school_year DESC, c.name ASC, c.id ASC';

/** Calendário de todas as escolas ou vinculado à escola não excluída. */
const SCHOOL_MATCH = `(c.all_schools = 1 OR EXISTS (
  SELECT 1
    FROM school s
    JOIN academic_calendar_school fs ON fs.school_id = s.id
   WHERE fs.calendar_id = c.id AND fs.school_id = :schoolId
     AND s.tenant_id = c.tenant_id AND s.deleted_at IS NULL))`;

/** Página e contagem dos calendários não excluídos do tenant. */
export function buildAcademicCalendarListQuery(
  filter: AcademicCalendarListFilter,
): PagedQuery {
  const ctx = createFilterContext();
  addRaw(ctx, 'c.tenant_id = :tenantId', { tenantId: filter.tenantId });
  addRaw(ctx, 'c.deleted_at IS NULL');
  addEq(ctx, 'c.school_year', 'year', filter.year);
  if (filter.schoolId !== undefined) {
    addRaw(ctx, SCHOOL_MATCH, { schoolId: filter.schoolId });
  }
  return buildPagedSelect({
    select: ACADEMIC_CALENDAR_COLUMNS,
    from: ACADEMIC_CALENDAR_FROM,
    ctx,
    orderBy: ORDER_BY,
    allowedOrderBy: [ORDER_BY],
    page: { page: filter.page, limit: filter.limit },
  });
}
