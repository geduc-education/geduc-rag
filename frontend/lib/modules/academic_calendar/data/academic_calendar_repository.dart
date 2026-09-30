import 'models/calendar_event.dart';
import 'models/calendar_school.dart';

/// Contrato do repositório do Calendário Acadêmico.
///
/// Filtro por escola devolve os registros **da escola e os da rede**
/// (`schoolId` nulo), que valem para todas.
abstract interface class IAcademicCalendarRepository {
  Future<List<CalendarSchool>> listSchools();

  Future<List<CalendarEvent>> listEvents({
    required int year,
    required int month,
    String? schoolId,
    CalendarEventType? type,
  });

  Future<CalendarEvent> create(CalendarEventInput input);

  Future<CalendarEvent> update(String id, CalendarEventInput input);

  Future<void> delete(String id);
}
