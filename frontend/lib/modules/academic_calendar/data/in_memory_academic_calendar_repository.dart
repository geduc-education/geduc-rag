import '../../../core/errors/app_exception.dart';
import 'academic_calendar_repository.dart';
import 'models/calendar_event.dart';
import 'models/calendar_school.dart';

/// Implementação em memória do [IAcademicCalendarRepository].
///
/// Ainda não há API de calendário no backend: esta fonte mantém a tela
/// funcional (dados de exemplo do mês corrente, CRUD durante a sessão) até o
/// endpoint existir — aí basta trocar o bind por um repositório HTTP.
class InMemoryAcademicCalendarRepository
    implements IAcademicCalendarRepository {
  InMemoryAcademicCalendarRepository({DateTime? today})
    : _events = _seedEvents(today ?? DateTime.now());

  static const List<CalendarSchool> _schools = <CalendarSchool>[
    CalendarSchool(id: 'school-1', name: 'UEB Darcy Ribeiro'),
    CalendarSchool(id: 'school-2', name: 'UEB Paulo Freire'),
    CalendarSchool(id: 'school-3', name: 'UEB Cecília Meireles'),
  ];

  final List<CalendarEvent> _events;
  int _sequence = 0;

  @override
  Future<List<CalendarSchool>> listSchools() async => _schools;

  @override
  Future<List<CalendarEvent>> listEvents({
    required int year,
    required int month,
    String? schoolId,
    CalendarEventType? type,
  }) async {
    final matches = _events.where(
      (e) =>
          e.date.year == year &&
          e.date.month == month &&
          (schoolId == null || e.isNetworkWide || e.schoolId == schoolId) &&
          (type == null || e.type == type),
    );
    return matches.toList()..sort((a, b) => a.date.compareTo(b.date));
  }

  @override
  Future<CalendarEvent> create(CalendarEventInput input) async {
    final event = _build('local-${++_sequence}', input);
    _events.add(event);
    return event;
  }

  @override
  Future<CalendarEvent> update(String id, CalendarEventInput input) async {
    final index = _indexOf(id);
    return _events[index] = _build(id, input);
  }

  @override
  Future<void> delete(String id) async => _events.removeAt(_indexOf(id));

  int _indexOf(String id) {
    final index = _events.indexWhere((e) => e.id == id);
    if (index < 0) {
      throw const AppException(
        message: 'Registro não encontrado.',
        statusCode: 404,
        code: 'CALENDAR_EVENT_NOT_FOUND',
      );
    }
    return index;
  }

  CalendarEvent _build(String id, CalendarEventInput input) {
    final school = _schools.where((s) => s.id == input.schoolId).firstOrNull;
    return CalendarEvent(
      id: id,
      title: input.title,
      type: input.type,
      date: input.date,
      schoolId: school?.id,
      schoolName: school?.name,
      description: input.description,
      observation: input.observation,
    );
  }

  static List<CalendarEvent> _seedEvents(DateTime today) {
    final school = _schools.first;
    DateTime day(int d) => DateTime(today.year, today.month, d);
    CalendarEvent seed(
      int n,
      String title,
      CalendarEventType type, {
      CalendarSchool? at,
      String? description,
    }) => CalendarEvent(
      id: 'seed-$n',
      title: title,
      type: type,
      date: day(n),
      schoolId: at?.id,
      schoolName: at?.name,
      description: description,
    );
    return <CalendarEvent>[
      seed(
        2,
        'Início do bimestre',
        CalendarEventType.evento,
        description: 'Data de início do bimestre',
      ),
      seed(5, 'Sábado letivo', CalendarEventType.diaLetivo, at: school),
      seed(9, 'Planejamento', CalendarEventType.planejamentoAula, at: school),
      seed(12, 'Dia letivo', CalendarEventType.diaLetivo),
      seed(16, 'Formação continuada', CalendarEventType.formacaoPedagogica),
      seed(20, 'Ponto facultativo', CalendarEventType.pontoFacultativo),
      seed(
        23,
        'Início tardio de aulas',
        CalendarEventType.diaNaoLetivo,
        at: school,
      ),
      seed(26, 'Dia letivo', CalendarEventType.diaLetivo),
    ];
  }
}
