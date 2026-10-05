import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/modules/academic_calendar/data/models/calendar_day.dart';
import 'package:geduc_rag/modules/academic_calendar/data/models/calendar_day_type.dart';
import 'package:geduc_rag/modules/weekly_schedules/data/models/schedule_day.dart';
import 'package:geduc_rag/modules/weekly_schedules/data/models/schedule_lookups.dart';
import 'package:geduc_rag/modules/weekly_schedules/data/models/schedule_replication.dart';
import 'package:geduc_rag/modules/weekly_schedules/data/models/schedule_week.dart';
import 'package:geduc_rag/modules/weekly_schedules/data/models/schedule_week_preview.dart';
import 'package:geduc_rag/modules/weekly_schedules/data/models/weekly_schedule.dart';

Map<String, dynamic> _scheduleJson() => <String, dynamic>{
  'id': 'w1',
  'schoolClassId': 'c1',
  'startDate': '2026-09-28',
  'endDate': '2026-10-04',
  'status': 'OUTDATED',
  'record': <String, dynamic>{
    'lessons': 2,
    'contentRecorded': 1,
    'attendanceRecorded': 0,
  },
  'createdAt': '2026-09-20T12:00:00.000Z',
  'updatedAt': '2026-09-20T12:00:00.000Z',
  'days': <Map<String, dynamic>>[
    <String, dynamic>{
      'date': '2026-09-28',
      'weekday': 1,
      'dayType': 'SCHOOL_DAY',
      'hasClass': true,
      'lessons': <Map<String, dynamic>>[
        <String, dynamic>{
          'id': 'l1',
          'lessonSlotId': 'slot1',
          'slotName': '1ª aula',
          'subjectId': 's1',
          'subjectName': 'Matemática',
          'startTime': '08:00',
          'endTime': '08:50',
          'contentRecorded': true,
          'attendanceRecorded': false,
        },
      ],
    },
    <String, dynamic>{
      'date': '2026-10-04',
      'weekday': 0,
      'dayType': null,
      'hasClass': false,
      'lessons': <Map<String, dynamic>>[],
    },
  ],
};

void main() {
  group('semana', () {
    test('normaliza qualquer dia para a segunda e formata dd/MM a dd/MM', () {
      expect(scheduleMondayOf(DateTime(2026, 10, 4)), DateTime(2026, 9, 28));
      expect(scheduleMondayOf(DateTime(2026, 9, 28)), DateTime(2026, 9, 28));
      expect(scheduleMondayOf(DateTime(2026, 10, 1)), DateTime(2026, 9, 28));
      expect(formatScheduleWeek(DateTime(2026, 9, 28)), '28/09 a 04/10');
      expect(scheduleWeekDates(DateTime(2026, 9, 28)).last.weekday, 7);
    });
  });

  group('WeeklySchedule.fromJson', () {
    test('lê resumo, dias, tipo nulo e aulas registradas', () {
      final schedule = WeeklySchedule.fromJson(_scheduleJson());
      final summary = schedule.summary;
      expect(summary.status, ScheduleStatus.outdated);
      expect(summary.startDate, DateTime(2026, 9, 28));
      expect(summary.periodLabel, '28/09 a 04/10');
      expect(summary.record.hasRecords, isTrue);
      expect(summary.createdAt, isNotNull);
      final monday = schedule.days.first;
      expect(monday.hasClass, isTrue);
      expect(monday.lessons.single.isRecorded, isTrue);
      final lesson = monday.lessons.single;
      expect(lesson.subjectName, 'Matemática');
      expect(lesson.lessonSlotId, 'slot1');
      expect(lesson.slotName, '1ª aula');
      expect(lesson.timeRange, '08:00–08:50');
      final sunday = schedule.days.last;
      expect(sunday.dayType, isNull);
      expect(sunday.typeLabel, 'Fora do calendário');
    });

    test('página da listagem', () {
      final page = WeeklySchedulesPage.fromJson(<String, dynamic>{
        'data': <Map<String, dynamic>>[_scheduleJson()],
        'total': 7,
      });
      expect(page.items.single.id, 'w1');
      expect(page.total, 7);
    });
  });

  group('payloads', () {
    test('create envia domingo = segunda + 6 e aulas por dia', () {
      final day = ScheduleDay(
        date: DateTime(2026, 9, 28),
        dayType: CalendarDayType.schoolDay,
        lessons: const <ScheduleLesson>[
          ScheduleLesson(
            lessonSlotId: 'slot1',
            subjectId: 's1',
            slotName: '1ª aula',
            startTime: '08:00',
            endTime: '09:00',
          ),
        ],
      );
      final json = CreateWeeklyScheduleInput(
        schoolClassId: 'c1',
        monday: DateTime(2026, 9, 28),
        days: <ScheduleDay>[day],
      ).toJson();
      expect(json['startDate'], '2026-09-28');
      expect(json['endDate'], '2026-10-04');
      expect((json['days'] as List).single, <String, dynamic>{
        'date': '2026-09-28',
        'lessons': <Map<String, dynamic>>[
          <String, dynamic>{'lessonSlotId': 'slot1', 'subjectId': 's1'},
        ],
      });
    });

    test('registro omite flag nula; replicação envia as segundas', () {
      expect(
        const LessonRecordUpdate(attendanceRecorded: true).toJson(),
        <String, dynamic>{'attendanceRecorded': true},
      );
      final json = ReplicateWeeklyScheduleInput(
        targetMondays: <DateTime>[DateTime(2026, 10, 5)],
      ).toJson();
      expect(json['targetStartDates'], <String>['2026-10-05']);
    });
  });

  test('ReplicationOutcome soma criadas, sobrescritas e descartes', () {
    final outcome = ReplicationOutcome.fromJson(<String, dynamic>{
      'data': <Map<String, dynamic>>[
        <String, dynamic>{
          'action': 'OVERWRITTEN',
          'schedule': _scheduleJson(),
          'preserved': <Map<String, dynamic>>[
            <String, dynamic>{
              'date': '2026-10-05',
              'lessonSlotId': 'slot1',
              'slotName': '1ª aula',
              'subjectId': 's1',
              'startTime': '08:00',
              'endTime': '08:50',
              'contentRecorded': true,
              'attendanceRecorded': false,
            },
          ],
          'discarded': <Map<String, dynamic>>[
            <String, dynamic>{
              'date': '2026-10-12',
              'subjectId': 's2',
              'startTime': '09:00',
              'endTime': '09:50',
              'reason': 'NON_SCHOOL_DAY',
            },
          ],
        },
        <String, dynamic>{'action': 'CREATED', 'schedule': _scheduleJson()},
      ],
    });
    expect(outcome.overwrittenCount, 1);
    expect(outcome.createdCount, 1);
    expect(outcome.preservedCount, 1);
    expect(outcome.discardedCount, 1);
    final discarded = outcome.results.first.discarded.single;
    expect(discarded.reason, DiscardReason.nonSchoolDay);
    final preserved = outcome.results.first.preserved.single;
    expect(preserved.reason, isNull);
    expect(preserved.lessonSlotId, 'slot1');
    expect(preserved.slotName, '1ª aula');
  });

  test('lookups leem o envelope paginado', () {
    final classes = scheduleItemsFromPage(<String, dynamic>{
      'data': <Map<String, dynamic>>[
        <String, dynamic>{
          'id': 'c1',
          'name': '5º A',
          'schoolId': 'e1',
          'schoolYear': 2026,
        },
      ],
    }, ScheduleClass.fromJson);
    expect(classes.single.label, '5º A (2026)');
    expect(classes.single.schoolId, 'e1');
    final slots = scheduleItemsFromPage(<String, dynamic>{
      'data': <Map<String, dynamic>>[
        <String, dynamic>{
          'id': 'slot1',
          'schoolId': 'e1',
          'name': '1ª aula',
          'startTime': '07:00',
          'endTime': '07:50',
          'position': 1,
        },
      ],
    }, ScheduleLessonSlot.fromJson);
    expect(slots.single.label, '1ª aula · 07:00–07:50');
  });

  test('aulas do dia ordenam pelo início do horário', () {
    final day =
        ScheduleDay(
          date: DateTime(2026, 9, 28),
          dayType: CalendarDayType.schoolDay,
        ).withLessons(const <ScheduleLesson>[
          ScheduleLesson(lessonSlotId: 'b', subjectId: 's', startTime: '07:50'),
          ScheduleLesson(lessonSlotId: 'a', subjectId: 's', startTime: '07:00'),
        ]);
    expect(day.lessons.map((l) => l.lessonSlotId), <String>['a', 'b']);
  });

  test('prévia: calendário da escola prevalece; sem calendário = null', () {
    final monday = DateTime(2026, 9, 28);
    CalendarDay day(DateTime d, CalendarDayType t) =>
        CalendarDay(date: d, weekday: d.weekday % 7, type: t);
    final days = resolveScheduleWeek(monday, <CalendarWeekSource>[
      CalendarWeekSource(
        calendarId: 'a',
        specific: false,
        days: <CalendarDay>[day(monday, CalendarDayType.schoolDay)],
      ),
      CalendarWeekSource(
        calendarId: 'z',
        specific: true,
        days: <CalendarDay>[day(monday, CalendarDayType.teacherTraining)],
      ),
    ]);
    expect(days, hasLength(7));
    expect(days.first.dayType, CalendarDayType.teacherTraining);
    expect(days[1].dayType, isNull);
  });
}
