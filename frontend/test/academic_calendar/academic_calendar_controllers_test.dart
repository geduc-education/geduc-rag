import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/modules/academic_calendar/data/models/academic_calendar.dart';
import 'package:geduc_rag/modules/academic_calendar/data/models/calendar_day.dart';
import 'package:geduc_rag/modules/academic_calendar/data/models/calendar_day_type.dart';
import 'package:geduc_rag/modules/academic_calendar/data/models/calendar_school.dart';
import 'package:geduc_rag/modules/academic_calendar/presentation/academic_calendar_form_controller.dart';
import 'package:geduc_rag/modules/academic_calendar/presentation/academic_calendars_list_controller.dart';
import 'package:geduc_rag/modules/academic_calendar/presentation/calendar_days_controller.dart';

import '../support/fake_academic_calendar_repository.dart';

final DateTime _today = DateTime(2026, 9, 30);

final AcademicCalendar _calendar = AcademicCalendar(
  id: 'c1',
  year: 2026,
  name: 'Calendário 2026',
  startDate: DateTime(2026, 2, 2),
  endDate: DateTime(2026, 12, 18),
);

FakeAcademicCalendarRepository _repo() => FakeAcademicCalendarRepository(
  calendars: <AcademicCalendar>[_calendar],
  schools: const <CalendarSchool>[CalendarSchool(id: 's1', name: 'EMEF A')],
);

void main() {
  group('AcademicCalendarsListController', () {
    test('carrega escolas e calendários uma vez e filtra por ano', () async {
      final repo = _repo();
      final c = AcademicCalendarsListController(repo, clock: () => _today);
      await c.ensureLoaded();
      await c.ensureLoaded();
      expect(c.state, AcademicCalendarsViewState.ready);
      expect(c.schools.single.name, 'EMEF A');
      expect(repo.calls.where((x) => x == 'list'), hasLength(1));
      expect(c.yearOptions, <int>[2024, 2025, 2026, 2027, 2028]);

      await c.setYear(2025);
      expect(repo.lastList?.year, 2025);
      expect(c.state, AcademicCalendarsViewState.empty);
      await c.setSchool('s1');
      expect(repo.lastList?.schoolId, 's1');
    });

    test('erro vira estado de erro com mensagem amigável', () async {
      final repo = _repo()
        ..failWith = const AppException(
          message: 'x',
          statusCode: 403,
          code: 'TENANT_OUT_OF_SCOPE',
        );
      final c = AcademicCalendarsListController(repo);
      await c.load();
      expect(c.state, AcademicCalendarsViewState.error);
      expect(c.error, contains('tenant'));
      expect(await c.remove(_calendar), contains('tenant'));
    });

    test('remove exclui e recarrega', () async {
      final repo = _repo();
      final c = AcademicCalendarsListController(repo);
      expect(await c.remove(_calendar), isNull);
      expect(repo.removedId, 'c1');
      expect(repo.calls.last, 'list');
    });
  });

  group('CalendarDaysController', () {
    test('abre no mês de hoje com totals do período', () async {
      final repo = _repo();
      final c = CalendarDaysController(repo, clock: () => _today);
      await c.open(_calendar);
      expect(c.state, CalendarDaysState.ready);
      expect(repo.lastDays?.view, CalendarView.month);
      expect(repo.lastDays?.date, DateTime(2026, 9, 30));
      expect(c.totals.countOf(CalendarDayType.schoolDay), 22);
      expect(c.totals.countOf(CalendarDayType.nonSchoolDay), 8);
      expect(c.dayOn(DateTime(2026, 9, 6))?.isSunday, isTrue);
    });

    test(
      'fora do período abre no início; navegação respeita limites',
      () async {
        final repo = _repo();
        final c = CalendarDaysController(repo, clock: () => DateTime(2027));
        await c.open(_calendar);
        expect(c.date, DateTime(2026, 2, 2));
        expect(c.canGoPrevious, isFalse);
        expect(c.canGoNext, isTrue);
        await c.next();
        expect(c.period?.startDate, DateTime(2026, 3));
        await c.setView(CalendarView.week);
        expect(c.period?.startDate, DateTime(2026, 3));
        expect(c.period?.endDate, DateTime(2026, 3, 7));
        await c.setView(CalendarView.year);
        expect(c.canGoNext, isFalse);
        expect(c.days, hasLength(320));
        await c.goTo(DateTime(2026, 5, 10), view: CalendarView.day);
        expect(c.days.single.date, DateTime(2026, 5, 10));
      },
    );

    test('updateDay salva e recarrega; erro vira mensagem', () async {
      final repo = _repo();
      final c = CalendarDaysController(repo, clock: () => _today);
      await c.open(_calendar);
      final day = c.dayOn(DateTime(2026, 9, 7))!;
      final error = await c.updateDay(
        day,
        const CalendarDayUpdate(type: CalendarDayType.optionalDay),
      );
      expect(error, isNull);
      expect(c.totals.countOf(CalendarDayType.optionalDay), 1);

      repo.failWith = const AppException(
        message: 'x',
        statusCode: 400,
        code: 'CALENDAR_SUNDAY_IMMUTABLE',
      );
      final sunday = c.dayOn(DateTime(2026, 9, 6))!;
      expect(
        await c.updateDay(
          sunday,
          const CalendarDayUpdate(type: CalendarDayType.schoolDay),
        ),
        contains('domingo'),
      );
    });

    test('close limpa o calendário aberto', () async {
      final c = CalendarDaysController(_repo(), clock: () => _today);
      await c.open(_calendar);
      c.close();
      expect(c.calendar, isNull);
      expect(c.days, isEmpty);
      expect(c.state, CalendarDaysState.idle);
    });
  });

  group('AcademicCalendarFormController', () {
    test('valida período no ano e escolas antes de chamar a API', () async {
      final repo = _repo();
      final c = AcademicCalendarFormController(repo, defaultYear: 2026);
      expect(await c.save('Novo'), isNull);
      expect(c.error, contains('Informe a data'));

      c
        ..setStartDate(DateTime(2026, 2, 2))
        ..setEndDate(DateTime(2027, 1, 10));
      expect(await c.save('Novo'), isNull);
      expect(c.error, contains('ano letivo'));

      c
        ..setEndDate(DateTime(2026, 12, 18))
        ..setAllSchools(false);
      expect(await c.save('Novo'), isNull);
      expect(c.error, contains('escola'));
      expect(repo.calls, isEmpty);

      c.toggleSchool('s1');
      final saved = await c.save('Novo');
      expect(saved?.id, 'new');
      expect(repo.created?.toJson()['schoolIds'], <String>['s1']);
      expect(c.error, isNull);
    });

    test('edição envia só nome e escolas', () async {
      final repo = _repo();
      final c = AcademicCalendarFormController(
        repo,
        defaultYear: 2026,
        editing: _calendar,
      );
      expect(c.isEditing, isTrue);
      expect(await c.save('Renomeado'), isNotNull);
      expect(repo.updated?.toJson(), <String, dynamic>{
        'name': 'Renomeado',
        'allSchools': true,
      });
    });

    test('erro da API fica em error', () async {
      final repo = _repo()
        ..failWith = const AppException(
          message: 'x',
          statusCode: 400,
          code: 'CALENDAR_SCHOOLS_INVALID',
        );
      final c = AcademicCalendarFormController(
        repo,
        defaultYear: 2026,
        editing: _calendar,
      );
      expect(await c.save('Nome'), isNull);
      expect(c.error, contains('Todas as escolas'));
      expect(c.saving, isFalse);
    });
  });
}
