import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/modules/academic_calendar/data/models/calendar_day_type.dart';
import 'package:geduc_rag/modules/weekly_schedules/data/models/schedule_day.dart';
import 'package:geduc_rag/modules/weekly_schedules/data/models/schedule_lookups.dart';
import 'package:geduc_rag/modules/weekly_schedules/data/models/weekly_schedule.dart';
import 'package:geduc_rag/modules/weekly_schedules/presentation/schedule_lesson_rules.dart';
import 'package:geduc_rag/modules/weekly_schedules/presentation/weekly_schedule_editor_args.dart';
import 'package:geduc_rag/modules/weekly_schedules/presentation/weekly_schedule_editor_controller.dart';

import '../support/fake_weekly_schedules_repository.dart';

const ScheduleClass _class = ScheduleClass(
  id: 'c1',
  name: '5º A',
  schoolId: 'e1',
  schoolYear: 2026,
);

const List<ScheduleSubject> _subjects = <ScheduleSubject>[
  ScheduleSubject(id: 's1', name: 'Matemática'),
  ScheduleSubject(id: 's2', name: 'Português'),
];

const List<ScheduleLessonSlot> _slots = <ScheduleLessonSlot>[
  ScheduleLessonSlot(
    id: 'p1',
    name: '1ª aula',
    startTime: '07:00',
    endTime: '07:50',
  ),
  ScheduleLessonSlot(
    id: 'p2',
    name: '2ª aula',
    startTime: '07:50',
    endTime: '08:40',
  ),
  ScheduleLessonSlot(
    id: 'p3',
    name: '3ª aula',
    startTime: '08:40',
    endTime: '09:30',
  ),
];

final DateTime _monday = DateTime(2026, 9, 28);
final DateTime _saturday = DateTime(2026, 10, 3);

ScheduleLesson _lesson(String slot, [String subject = 's1']) =>
    ScheduleLesson(lessonSlotId: slot, subjectId: subject);

FakeWeeklySchedulesRepository _repo({
  CalendarDayType saturday = CalendarDayType.nonSchoolDay,
  List<ScheduleLessonSlot> slots = _slots,
}) => FakeWeeklySchedulesRepository(
  subjects: _subjects,
  slots: slots,
  saturday: saturday,
);

Future<WeeklyScheduleEditorController> _newWeek(
  FakeWeeklySchedulesRepository repo, {
  DateTime? date,
}) async {
  final c = WeeklyScheduleEditorController(repo);
  await c.open(
    WeeklyScheduleEditorArgs.create(
      schoolClass: _class,
      date: date ?? DateTime(2026, 9, 30),
    ),
  );
  return c;
}

/// Horário salvo com uma aula registrada na segunda.
WeeklySchedule _savedWithRecord() {
  final days = fakeScheduleWeek(_monday).toList();
  days[0] = days[0].withLessons(const <ScheduleLesson>[
    ScheduleLesson(
      id: 'l1',
      lessonSlotId: 'p1',
      slotName: '1ª aula',
      startTime: '07:00',
      endTime: '07:50',
      subjectId: 's1',
      subjectName: 'Matemática',
      contentRecorded: true,
    ),
    ScheduleLesson(
      id: 'l2',
      lessonSlotId: 'p2',
      slotName: '2ª aula',
      startTime: '07:50',
      endTime: '08:40',
      subjectId: 's2',
      subjectName: 'Português',
    ),
  ]);
  return WeeklySchedule(
    summary: WeeklyScheduleSummary(
      id: 'w1',
      schoolClassId: 'c1',
      startDate: _monday,
      status: ScheduleStatus.upToDate,
    ),
    days: days,
  );
}

void main() {
  test(
    'semana nova normaliza a data para a segunda e prevê os tipos',
    () async {
      final repo = _repo();
      final c = await _newWeek(repo, date: DateTime(2026, 10, 4));
      expect(c.state, ScheduleEditorState.ready);
      expect(c.isNew, isTrue);
      expect(c.monday, _monday);
      expect(c.periodLabel, '28/09 a 04/10');
      expect(repo.lastPreview?.schoolId, 'e1');
      expect(repo.lastPreview?.monday, _monday);
      expect(c.days, hasLength(7));
      expect(repo.lastSlotsSchoolId, 'e1');
      expect(c.slots, hasLength(3));
      expect(c.hasSlots, isTrue);
    },
  );

  test('dia não letivo não aceita aula', () async {
    final c = await _newWeek(_repo());
    final sunday = DateTime(2026, 10, 4);
    final error = c.addLesson(sunday, _lesson('p1'));
    expect(error, contains('Só dias letivos'));
    expect(error, contains('Dia não letivo'));
    expect(c.dayOn(sunday)!.lessons, isEmpty);
    expect(c.dirty, isFalse);
  });

  test('seleção de horário preenche nome e horas e ordena o dia', () async {
    final c = await _newWeek(_repo());
    expect(c.addLesson(_monday, _lesson('')), contains('horário da aula'));
    expect(c.addLesson(_monday, _lesson('x')), contains('inválido'));
    expect(c.addLesson(_monday, _lesson('p2')), isNull);
    final added = c.dayOn(_monday)!.lessons.single;
    expect(added.subjectName, 'Matemática');
    expect(added.slotName, '2ª aula');
    expect(added.timeRange, '07:50–08:40');
    expect(added.toJson(), <String, dynamic>{
      'lessonSlotId': 'p2',
      'subjectId': 's1',
    });
    expect(c.addLesson(_monday, _lesson('p1', 's2')), isNull);
    final ids = c.dayOn(_monday)!.lessons.map((l) => l.lessonSlotId);
    expect(ids, <String>['p1', 'p2']);
    expect(c.updateLesson(_monday, 1, _lesson('p3')), isNull);
    expect(c.dayOn(_monday)!.lessons.last.slotName, '3ª aula');
    expect(c.dirty, isTrue);
  });

  test('horário em uso no dia fica indisponível, exceto o da aula', () async {
    final c = await _newWeek(_repo());
    c
      ..addLesson(_monday, _lesson('p1'))
      ..addLesson(_monday, _lesson('p2', 's2'));
    expect(c.usedSlotIds(_monday), <String>{'p1', 'p2'});
    expect(c.usedSlotIds(_monday, except: 0), <String>{'p2'});
    expect(c.usedSlotIds(DateTime(2026, 9, 29)), isEmpty);
    expect(
      c.addLesson(_monday, _lesson('p1', 's2')),
      contains('já está ocupado neste dia pela aula de Matemática'),
    );
    expect(c.updateLesson(_monday, 0, _lesson('p2')), contains('ocupado'));
    expect(c.updateLesson(_monday, 0, _lesson('p1', 's2')), isNull);
    expect(c.addLesson(DateTime(2026, 9, 29), _lesson('p1')), isNull);
  });

  test('escola sem horários avisa e não aceita aula', () async {
    final c = await _newWeek(_repo(slots: const <ScheduleLessonSlot>[]));
    expect(c.state, ScheduleEditorState.ready);
    expect(c.hasSlots, isFalse);
    expect(c.addLesson(_monday, _lesson('p1')), noLessonSlotsMessage);
    expect(c.dayOn(_monday)!.lessons, isEmpty);
    expect(c.dirty, isFalse);
  });

  test('sábado letivo sem aula bloqueia o salvamento e é destacado', () async {
    final repo = _repo(saturday: CalendarDayType.schoolDay);
    final c = await _newWeek(repo);
    expect(await c.save(), isFalse);
    expect(c.saveError, contains('sábado 03/10'));
    expect(c.highlightedDate, _saturday);
    expect(repo.calls, isNot(contains('create')));

    expect(c.addLesson(_saturday, _lesson('p1')), isNull);
    expect(c.highlightedDate, isNull);
    expect(c.saveError, isNull);
    expect(await c.save(), isTrue);
    expect(repo.created?.schoolClassId, 'c1');
    expect(repo.created?.toJson()['endDate'], '2026-10-04');
    expect(c.isNew, isFalse);
    expect(c.dayOn(_saturday)!.lessons.single.id, isNotNull);
  });

  test('erro de sábado do backend também destaca o sábado', () async {
    final repo = _repo(saturday: CalendarDayType.schoolDay);
    final c = await _newWeek(repo);
    c.addLesson(_saturday, _lesson('p1'));
    repo.failWith = const AppException(
      message: 'x',
      statusCode: 400,
      code: 'SCHEDULE_SATURDAY_WITHOUT_LESSONS',
    );
    expect(await c.save(), isFalse);
    expect(c.saveError, contains('sábado'));
    expect(c.highlightedDate, _saturday);
  });

  group('horário salvo', () {
    Future<(FakeWeeklySchedulesRepository, WeeklyScheduleEditorController)>
    open() async {
      final repo = _repo()..detail = _savedWithRecord();
      final c = WeeklyScheduleEditorController(repo);
      await c.open(const WeeklyScheduleEditorArgs.edit(scheduleId: 'w1'));
      return (repo, c);
    }

    test('sem escola nos args, busca a escola pela turma', () async {
      final (repo, c) = await open();
      expect(repo.calls, contains('getClass'));
      expect(repo.lastSlotsSchoolId, 'e1');
      expect(c.slots, hasLength(3));
    });

    test('aula registrada fica travada', () async {
      final (_, c) = await open();
      expect(c.removeLesson(_monday, 0), contains('registrados'));
      expect(c.updateLesson(_monday, 0, _lesson('p3')), isNotNull);
      expect(c.dayOn(_monday)!.lessons, hasLength(2));
      expect(c.removeLesson(_monday, 1), isNull);
      expect(c.dayOn(_monday)!.lessons, hasLength(1));
    });

    test('toggle de registro faz PATCH e atualiza a aula', () async {
      final (repo, c) = await open();
      expect(await c.toggleRecord(_monday, 1, attendance: true), isNull);
      expect(repo.recordUpdate?.toJson(), <String, dynamic>{
        'attendanceRecorded': true,
      });
      expect(c.dayOn(_monday)!.lessons[1].isRecorded, isTrue);
    });

    test('409 SCHEDULE_HAS_RECORDS vira mensagem clara no save', () async {
      final (repo, c) = await open();
      repo.failWith = const AppException(
        message: 'x',
        statusCode: 409,
        code: 'SCHEDULE_HAS_RECORDS',
      );
      expect(await c.save(), isFalse);
      expect(c.saveError, contains('não podem ser alteradas'));
    });

    test('aula não salva não pode ser registrada', () async {
      final (_, c) = await open();
      c.addLesson(DateTime(2026, 9, 29), _lesson('p1'));
      final error = await c.toggleRecord(
        DateTime(2026, 9, 29),
        0,
        content: true,
      );
      expect(error, contains('Salve o horário'));
    });
  });
}
