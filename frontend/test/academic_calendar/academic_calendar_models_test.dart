import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/modules/academic_calendar/data/models/academic_calendar.dart';
import 'package:geduc_rag/modules/academic_calendar/data/models/calendar_day.dart';
import 'package:geduc_rag/modules/academic_calendar/data/models/calendar_day_type.dart';
import 'package:geduc_rag/modules/academic_calendar/data/models/calendar_school.dart';
import 'package:geduc_rag/modules/academic_calendar/data/models/day_type_totals.dart';

const Map<String, dynamic> _totalsJson = <String, dynamic>{
  'SCHOOL_DAY': 200,
  'NON_SCHOOL_DAY': 110,
  'OPTIONAL_DAY': 3,
  'LESSON_PLANNING': 2,
  'TEACHER_TRAINING': 5,
  'total': 320,
};

void main() {
  test('CalendarDayType mapeia códigos da API e rótulos', () {
    expect(CalendarDayType.fromCode('SCHOOL_DAY'), CalendarDayType.schoolDay);
    expect(CalendarDayType.optionalDay.label, 'Ponto facultativo');
    expect(CalendarDayType.fromCode('EVENTO'), isNull);
    expect(CalendarView.fromCode('week'), CalendarView.week);
  });

  test('AcademicCalendar.fromJson lê detalhe com totals', () {
    final calendar = AcademicCalendar.fromJson(const <String, dynamic>{
      'id': 'c1',
      'tenantId': 't1',
      'year': 2026,
      'name': 'Calendário 2026',
      'startDate': '2026-02-02',
      'endDate': '2026-12-18',
      'allSchools': false,
      'schoolIds': <String>['s1', 's2'],
      'createdAt': '2026-01-10T12:00:00.000Z',
      'updatedAt': '2026-01-10T12:00:00.000Z',
      'totals': _totalsJson,
    });
    expect(calendar.startDate, DateTime(2026, 2, 2));
    expect(calendar.endDate, DateTime(2026, 12, 18));
    expect(calendar.allSchools, isFalse);
    expect(calendar.schoolIds, <String>['s1', 's2']);
    expect(calendar.totals?.countOf(CalendarDayType.teacherTraining), 5);
    expect(calendar.totals?.total, 320);
    expect(calendar.contains(DateTime(2026, 2, 2, 15)), isTrue);
    expect(calendar.contains(DateTime(2026, 2, 1)), isFalse);
    expect(calendar.toJson()['startDate'], '2026-02-02');
  });

  test('AcademicCalendarsPage lê o envelope { data, total }', () {
    final page = AcademicCalendarsPage.fromJson(const <String, dynamic>{
      'data': <Map<String, dynamic>>[
        <String, dynamic>{
          'id': 'c1',
          'year': 2026,
          'name': 'A',
          'startDate': '2026-02-02',
          'endDate': '2026-12-18',
          'allSchools': true,
          'schoolIds': <String>[],
        },
      ],
      'total': 1,
    });
    expect(page.items.single.totals, isNull);
    expect(page.total, 1);
  });

  test('CalendarDaysPeriod.fromJson lê dias, visão e totals', () {
    final period = CalendarDaysPeriod.fromJson(const <String, dynamic>{
      'calendarId': 'c1',
      'view': 'week',
      'startDate': '2026-02-01',
      'endDate': '2026-02-07',
      'days': <Map<String, dynamic>>[
        <String, dynamic>{
          'date': '2026-02-01',
          'weekday': 0,
          'type': 'NON_SCHOOL_DAY',
          'description': null,
          'updatedAt': '2026-01-10T12:00:00.000Z',
        },
        <String, dynamic>{
          'date': '2026-02-04',
          'weekday': 3,
          'type': 'LESSON_PLANNING',
          'description': 'Planejamento',
          'updatedAt': '2026-01-10T12:00:00.000Z',
        },
      ],
      'totals': _totalsJson,
    });
    expect(period.view, CalendarView.week);
    expect(period.startDate, DateTime(2026, 2, 1));
    expect(period.days.first.isSunday, isTrue);
    expect(period.days.last.type, CalendarDayType.lessonPlanning);
    expect(period.days.last.description, 'Planejamento');
    expect(period.totals.countOf(CalendarDayType.schoolDay), 200);
  });

  test('inputs serializam só o que o backend aceita', () {
    final create = CreateAcademicCalendarInput(
      year: 2026,
      name: ' Calendário ',
      startDate: DateTime(2026, 2, 2),
      endDate: DateTime(2026, 12, 18),
      allSchools: true,
      schoolIds: const <String>['s1'],
    ).toJson();
    expect(create, <String, dynamic>{
      'year': 2026,
      'name': 'Calendário',
      'startDate': '2026-02-02',
      'endDate': '2026-12-18',
      'allSchools': true,
    });
    expect(
      const UpdateAcademicCalendarInput(
        allSchools: false,
        schoolIds: <String>['s1'],
      ).toJson(),
      <String, dynamic>{
        'allSchools': false,
        'schoolIds': <String>['s1'],
      },
    );
    expect(
      const CalendarDayUpdate(description: '  ').toJson(),
      <String, dynamic>{'description': null},
    );
    expect(DayTypeTotals.fromJson(_totalsJson).toJson(), _totalsJson);
  });

  test('CalendarSchool lê a página de /schools', () {
    final schools = CalendarSchool.listFromPage(const <String, dynamic>{
      'data': <Map<String, dynamic>>[
        <String, dynamic>{'id': 's1', 'name': 'EMEF A', 'active': false},
      ],
      'total': 1,
    });
    expect(schools.single.label, 'EMEF A (inativa)');
  });
}
