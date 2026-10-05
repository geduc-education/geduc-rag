import '../../../core/http/api_client.dart';
import '../../academic_calendar/data/models/academic_calendar.dart';
import '../../academic_calendar/data/models/calendar_day.dart';
import '../../academic_calendar/data/models/calendar_day_type.dart';
import 'models/schedule_day.dart';
import 'models/schedule_lookups.dart';
import 'models/schedule_replication.dart';
import 'models/schedule_week.dart';
import 'models/schedule_week_preview.dart';
import 'models/weekly_schedule.dart';

/// Contrato do repositório do Horário Semanal. Todas as rotas são escopadas
/// pelo tenant ativo — o header `tenant-id` vem do [ApiClient].
abstract interface class IWeeklySchedulesRepository {
  /// `GET /weekly-schedules`; [from]/[to] pegam semanas que cruzam o
  /// intervalo.
  Future<WeeklySchedulesPage> list({
    String? schoolClassId,
    DateTime? from,
    DateTime? to,
    int page = 1,
    int limit = 20,
  });
  Future<WeeklySchedule> getById(String id);
  Future<WeeklySchedule> create(CreateWeeklyScheduleInput input);
  Future<WeeklySchedule> update(String id, UpdateWeeklyScheduleInput input);
  Future<void> remove(String id);
  Future<ReplicationOutcome> replicate(
    String id,
    ReplicateWeeklyScheduleInput input,
  );
  Future<ScheduleLesson> updateLessonRecord(
    String scheduleId,
    String lessonId,
    LessonRecordUpdate input,
  );

  /// Tipos dos 7 dias de uma semana ainda não salva, pelos calendários da
  /// escola (mesma resolução do backend).
  Future<List<ScheduleDay>> previewWeek(String schoolId, DateTime monday);

  Future<List<ScheduleSchool>> listSchools();

  /// Turmas; com [schoolId], só as da escola.
  Future<List<ScheduleClass>> listClasses({String? schoolId});

  /// Turma pelo id (`GET /school-classes/:id`), para achar a escola.
  Future<ScheduleClass> getClass(String id);
  Future<List<ScheduleSubject>> listSubjects();

  /// Horários de aula da escola, na ordem da API.
  Future<List<ScheduleLessonSlot>> listLessonSlots(String schoolId);
}

class WeeklySchedulesRepository implements IWeeklySchedulesRepository {
  WeeklySchedulesRepository(this._client);

  final ApiClient _client;

  /// Limite máximo aceito pelas listagens do backend.
  static const int maxLimit = 100;

  static const String _base = '/weekly-schedules';

  @override
  Future<WeeklySchedulesPage> list({
    String? schoolClassId,
    DateTime? from,
    DateTime? to,
    int page = 1,
    int limit = 20,
  }) async {
    final data = await _get(
      _base,
      query: <String, dynamic>{
        'page': page,
        'limit': limit > maxLimit ? maxLimit : limit,
        'schoolClassId': ?schoolClassId,
        'from': ?_wire(from),
        'to': ?_wire(to),
      },
    );
    return WeeklySchedulesPage.fromJson(data);
  }

  @override
  Future<WeeklySchedule> getById(String id) async =>
      WeeklySchedule.fromJson(await _get('$_base/$id'));

  @override
  Future<WeeklySchedule> create(CreateWeeklyScheduleInput input) async {
    final response = await _client.post<Map<String, dynamic>>(
      _base,
      data: input.toJson(),
    );
    return WeeklySchedule.fromJson(_body(response.data));
  }

  @override
  Future<WeeklySchedule> update(
    String id,
    UpdateWeeklyScheduleInput input,
  ) async {
    final response = await _client.put<Map<String, dynamic>>(
      '$_base/$id',
      data: input.toJson(),
    );
    return WeeklySchedule.fromJson(_body(response.data));
  }

  @override
  Future<void> remove(String id) => _client.delete<void>('$_base/$id');

  @override
  Future<ReplicationOutcome> replicate(
    String id,
    ReplicateWeeklyScheduleInput input,
  ) async {
    final response = await _client.post<Map<String, dynamic>>(
      '$_base/$id/replicate',
      data: input.toJson(),
    );
    return ReplicationOutcome.fromJson(_body(response.data));
  }

  @override
  Future<ScheduleLesson> updateLessonRecord(
    String scheduleId,
    String lessonId,
    LessonRecordUpdate input,
  ) async {
    final response = await _client.patch<Map<String, dynamic>>(
      '$_base/$scheduleId/lessons/$lessonId/record',
      data: input.toJson(),
    );
    return ScheduleLesson.fromJson(_body(response.data));
  }

  @override
  Future<List<ScheduleDay>> previewWeek(
    String schoolId,
    DateTime monday,
  ) async {
    final sunday = scheduleSundayOf(monday);
    final page = AcademicCalendarsPage.fromJson(
      await _get(
        '/academic-calendars',
        query: <String, dynamic>{'schoolId': schoolId, 'limit': maxLimit},
      ),
    );
    final applicable = page.items.where(
      (c) => c.contains(monday) || c.contains(sunday),
    );
    final sources = await Future.wait(
      applicable.map((c) => _weekSource(c, monday, sunday)),
    );
    return resolveScheduleWeek(monday, sources);
  }

  /// A visão `week` do calendário vai de domingo a sábado: a semana de
  /// [monday] e a de [sunday] juntas cobrem segunda → domingo.
  Future<CalendarWeekSource> _weekSource(
    AcademicCalendar calendar,
    DateTime monday,
    DateTime sunday,
  ) async {
    final periods = await Future.wait(
      <DateTime>[monday, sunday].map(
        (date) async => CalendarDaysPeriod.fromJson(
          await _get(
            '/academic-calendars/${calendar.id}/days',
            query: <String, dynamic>{
              'view': CalendarView.week.code,
              'date': formatCalendarWireDate(date),
            },
          ),
        ),
      ),
    );
    return CalendarWeekSource(
      calendarId: calendar.id,
      specific: !calendar.allSchools,
      days: <CalendarDay>[for (final p in periods) ...p.days],
    );
  }

  @override
  Future<List<ScheduleSchool>> listSchools() async => scheduleItemsFromPage(
    await _get('/schools', query: <String, dynamic>{'limit': maxLimit}),
    ScheduleSchool.fromJson,
  );

  @override
  Future<List<ScheduleClass>> listClasses({String? schoolId}) async =>
      scheduleItemsFromPage(
        await _get(
          '/school-classes',
          query: <String, dynamic>{'limit': maxLimit, 'schoolId': ?schoolId},
        ),
        ScheduleClass.fromJson,
      );

  @override
  Future<ScheduleClass> getClass(String id) async =>
      ScheduleClass.fromJson(await _get('/school-classes/$id'));

  @override
  Future<List<ScheduleLessonSlot>> listLessonSlots(String schoolId) async =>
      scheduleItemsFromPage(
        await _get('/schools/$schoolId/lesson-slots'),
        ScheduleLessonSlot.fromJson,
      );

  @override
  Future<List<ScheduleSubject>> listSubjects() async => scheduleItemsFromPage(
    await _get('/subjects', query: <String, dynamic>{'limit': maxLimit}),
    ScheduleSubject.fromJson,
  );

  Future<Map<String, dynamic>> _get(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    final response = await _client.get<Map<String, dynamic>>(
      path,
      queryParameters: query,
    );
    return _body(response.data);
  }

  static String? _wire(DateTime? date) =>
      date == null ? null : formatCalendarWireDate(date);

  static Map<String, dynamic> _body(Map<String, dynamic>? data) =>
      data ?? const <String, dynamic>{};
}
