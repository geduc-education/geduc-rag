import '../../../core/http/api_client.dart';
import 'models/academic_calendar.dart';
import 'models/calendar_day.dart';
import 'models/calendar_day_type.dart';
import 'models/calendar_school.dart';

/// Contrato do repositório do Calendário Acadêmico. Todas as rotas são
/// escopadas pelo tenant ativo — o header `tenant-id` vem do [ApiClient].
abstract interface class IAcademicCalendarRepository {
  /// Escolas do tenant (`GET /schools`), ativas e inativas.
  Future<List<CalendarSchool>> listSchools();

  /// `GET /academic-calendars`. Com [schoolId], traz os calendários de todas
  /// as escolas e os vinculados a ela.
  Future<AcademicCalendarsPage> list({
    int? year,
    String? schoolId,
    int page = 1,
    int limit = 100,
  });

  /// Detalhe com o quantitativo do calendário inteiro.
  Future<AcademicCalendar> getById(String id);
  Future<AcademicCalendar> create(CreateAcademicCalendarInput input);
  Future<AcademicCalendar> update(String id, UpdateAcademicCalendarInput input);
  Future<void> remove(String id);

  /// Dias da [view] que contém [date], com o quantitativo do período.
  Future<CalendarDaysPeriod> listDays(
    String id, {
    required CalendarView view,
    required DateTime date,
  });

  Future<CalendarDay> updateDay(
    String id,
    DateTime date,
    CalendarDayUpdate input,
  );
}

class AcademicCalendarRepository implements IAcademicCalendarRepository {
  AcademicCalendarRepository(this._client);

  final ApiClient _client;

  /// Limite máximo aceito pelas listagens do backend.
  static const int maxLimit = 100;

  static const String _base = '/academic-calendars';

  @override
  Future<List<CalendarSchool>> listSchools() async {
    final response = await _client.get<Map<String, dynamic>>(
      '/schools',
      queryParameters: <String, dynamic>{'limit': maxLimit},
    );
    return CalendarSchool.listFromPage(_body(response.data));
  }

  @override
  Future<AcademicCalendarsPage> list({
    int? year,
    String? schoolId,
    int page = 1,
    int limit = 100,
  }) async {
    final response = await _client.get<Map<String, dynamic>>(
      _base,
      queryParameters: <String, dynamic>{
        'page': page,
        'limit': limit > maxLimit ? maxLimit : limit,
        'year': ?year,
        'schoolId': ?schoolId,
      },
    );
    return AcademicCalendarsPage.fromJson(_body(response.data));
  }

  @override
  Future<AcademicCalendar> getById(String id) async {
    final response = await _client.get<Map<String, dynamic>>('$_base/$id');
    return AcademicCalendar.fromJson(_body(response.data));
  }

  @override
  Future<AcademicCalendar> create(CreateAcademicCalendarInput input) async {
    final response = await _client.post<Map<String, dynamic>>(
      _base,
      data: input.toJson(),
    );
    return AcademicCalendar.fromJson(_body(response.data));
  }

  @override
  Future<AcademicCalendar> update(
    String id,
    UpdateAcademicCalendarInput input,
  ) async {
    final response = await _client.patch<Map<String, dynamic>>(
      '$_base/$id',
      data: input.toJson(),
    );
    return AcademicCalendar.fromJson(_body(response.data));
  }

  @override
  Future<void> remove(String id) => _client.delete<void>('$_base/$id');

  @override
  Future<CalendarDaysPeriod> listDays(
    String id, {
    required CalendarView view,
    required DateTime date,
  }) async {
    final response = await _client.get<Map<String, dynamic>>(
      '$_base/$id/days',
      queryParameters: <String, dynamic>{
        'view': view.code,
        'date': formatCalendarWireDate(date),
      },
    );
    return CalendarDaysPeriod.fromJson(_body(response.data));
  }

  @override
  Future<CalendarDay> updateDay(
    String id,
    DateTime date,
    CalendarDayUpdate input,
  ) async {
    final response = await _client.patch<Map<String, dynamic>>(
      '$_base/$id/days/${formatCalendarWireDate(date)}',
      data: input.toJson(),
    );
    return CalendarDay.fromJson(_body(response.data));
  }

  static Map<String, dynamic> _body(Map<String, dynamic>? data) =>
      data ?? const <String, dynamic>{};
}
