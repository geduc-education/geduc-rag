import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/modules/academic_calendar/data/academic_calendar_repository.dart';
import 'package:geduc_rag/modules/academic_calendar/data/in_memory_academic_calendar_repository.dart';
import 'package:geduc_rag/modules/academic_calendar/data/models/calendar_event.dart';
import 'package:geduc_rag/modules/academic_calendar/data/models/calendar_school.dart';
import 'package:geduc_rag/modules/academic_calendar/presentation/academic_calendar_controller.dart';

final DateTime _today = DateTime(2026, 9, 30);

AcademicCalendarController _controller() => AcademicCalendarController(
  InMemoryAcademicCalendarRepository(today: _today),
  clock: () => _today,
);

/// Repositório que falha em toda leitura de registros.
class _FailingRepository implements IAcademicCalendarRepository {
  @override
  Future<List<CalendarSchool>> listSchools() async => const <CalendarSchool>[];

  @override
  Future<List<CalendarEvent>> listEvents({
    required int year,
    required int month,
    String? schoolId,
    CalendarEventType? type,
  }) async => throw const AppException(
    message: 'Serviço indisponível.',
    statusCode: 503,
  );

  @override
  Future<CalendarEvent> create(CalendarEventInput input) =>
      throw UnimplementedError();

  @override
  Future<CalendarEvent> update(String id, CalendarEventInput input) =>
      throw UnimplementedError();

  @override
  Future<void> delete(String id) async => throw StateError('falha');
}

void main() {
  test('carrega o mês corrente com escolas, registros e contagens', () async {
    final c = _controller();
    expect(c.state, AcademicCalendarViewState.loading);
    await c.ensureLoaded();
    expect(c.state, AcademicCalendarViewState.ready);
    expect(c.month, DateTime(2026, 9));
    expect(c.schools, hasLength(3));
    expect(c.events, isNotEmpty);
    expect(c.countOf(CalendarEventType.diaLetivo), 3);
    expect(c.eventsOn(5).single.title, 'Sábado letivo');
    expect(c.eventsOn(1), isEmpty);
  });

  test('filtros só valem após search()', () async {
    final c = _controller();
    await c.ensureLoaded();
    final all = c.events.length;
    c.selectType(CalendarEventType.diaLetivo);
    expect(c.events, hasLength(all));
    await c.search();
    expect(c.events, hasLength(3));
    expect(
      c.events.every((e) => e.type == CalendarEventType.diaLetivo),
      isTrue,
    );
  });

  test('filtro por escola mantém registros da rede', () async {
    final c = _controller();
    await c.ensureLoaded();
    c.selectSchool('school-2');
    await c.search();
    expect(c.events, isNotEmpty);
    expect(c.events.every((e) => e.isNetworkWide), isTrue);
  });

  test('navega entre meses', () async {
    final c = _controller();
    await c.ensureLoaded();
    await c.nextMonth();
    expect(c.month, DateTime(2026, 10));
    expect(c.events, isEmpty);
    await c.previousMonth();
    await c.previousMonth();
    expect(c.month, DateTime(2026, 8));
  });

  test('save cria e edita; delete remove e recarrega', () async {
    final c = _controller();
    await c.ensureLoaded();
    final before = c.events.length;
    final input = CalendarEventInput(
      title: 'Conselho de classe',
      type: CalendarEventType.evento,
      date: DateTime(2026, 9, 18),
      schoolId: 'school-1',
    );
    expect(await c.save(input), isNull);
    expect(c.events, hasLength(before + 1));
    final created = c.eventsOn(18).single;
    expect(created.scopeName, 'UEB Darcy Ribeiro');

    final edited = CalendarEventInput(
      title: 'Conselho de classe (2º)',
      type: CalendarEventType.evento,
      date: DateTime(2026, 9, 18),
    );
    expect(await c.save(edited, id: created.id), isNull);
    expect(c.eventsOn(18).single.isNetworkWide, isTrue);

    expect(await c.delete(created.id), isNull);
    expect(c.events, hasLength(before));
    expect(await c.delete(created.id), 'Registro não encontrado.');
  });

  test('erro na carga vira estado de erro com a mensagem', () async {
    final c = AcademicCalendarController(
      _FailingRepository(),
      clock: () => _today,
    );
    await c.ensureLoaded();
    expect(c.state, AcademicCalendarViewState.error);
    expect(c.error, 'Serviço indisponível.');
    expect(await c.delete('x'), 'Não foi possível excluir o registro.');
  });

  test('CalendarEvent faz round-trip de JSON', () {
    final event = CalendarEvent.fromJson(const <String, dynamic>{
      'id': 'e1',
      'title': 'Dia letivo',
      'type': 'DIA_LETIVO',
      'date': '2026-09-19',
      'schoolId': null,
      'schoolName': null,
    });
    expect(event.type, CalendarEventType.diaLetivo);
    expect(event.date, DateTime(2026, 9, 19));
    expect(event.scopeName, calendarNetworkScopeLabel);
    expect(event.toJson()['date'], '2026-09-19');
    expect(CalendarEventType.fromCode('NOVO'), CalendarEventType.evento);
  });
}
