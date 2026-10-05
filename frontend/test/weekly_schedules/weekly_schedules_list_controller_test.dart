import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/modules/weekly_schedules/data/models/schedule_day.dart';
import 'package:geduc_rag/modules/weekly_schedules/data/models/schedule_lookups.dart';
import 'package:geduc_rag/modules/weekly_schedules/data/models/schedule_replication.dart';
import 'package:geduc_rag/modules/weekly_schedules/data/models/weekly_schedule.dart';
import 'package:geduc_rag/modules/weekly_schedules/presentation/weekly_schedules_list_controller.dart';

import '../support/fake_weekly_schedules_repository.dart';

WeeklyScheduleSummary _summary(String id, String classId) =>
    WeeklyScheduleSummary(
      id: id,
      schoolClassId: classId,
      startDate: DateTime(2026, 9, 28),
      status: ScheduleStatus.upToDate,
    );

FakeWeeklySchedulesRepository _repo() => FakeWeeklySchedulesRepository(
  schedules: <WeeklyScheduleSummary>[
    _summary('w1', 'c1'),
    _summary('w2', 'c2'),
  ],
  schools: const <ScheduleSchool>[
    ScheduleSchool(id: 'e1', name: 'EMEF A'),
    ScheduleSchool(id: 'e2', name: 'EMEF B'),
  ],
  classes: const <ScheduleClass>[
    ScheduleClass(id: 'c1', name: '5º A', schoolId: 'e1'),
    ScheduleClass(id: 'c2', name: '6º B', schoolId: 'e2'),
  ],
  subjects: const <ScheduleSubject>[
    ScheduleSubject(id: 's1', name: 'Matemática'),
  ],
);

ReplicatedLesson _replicated(String date, [DiscardReason? reason]) =>
    ReplicatedLesson(
      date: DateTime.parse(date),
      subjectId: 's1',
      startTime: '08:00',
      endTime: '08:50',
      reason: reason,
    );

WeeklySchedule _target(String id, DateTime monday) => WeeklySchedule(
  summary: WeeklyScheduleSummary(
    id: id,
    schoolClassId: 'c1',
    startDate: monday,
    status: ScheduleStatus.upToDate,
  ),
  days: const <ScheduleDay>[],
);

void main() {
  test('carrega auxiliares e lista; nomes de turma e disciplina', () async {
    final c = WeeklySchedulesListController(_repo());
    await c.bootstrap();
    expect(c.state, WeeklySchedulesViewState.ready);
    expect(c.items, hasLength(2));
    expect(c.className('c1'), '5º A');
    expect(c.subjectName('s1'), 'Matemática');
  });

  test('escola filtra turmas e itens; turma vai para a query', () async {
    final repo = _repo();
    final c = WeeklySchedulesListController(repo);
    await c.bootstrap();
    await c.setClass('c2');
    expect(repo.lastList?.schoolClassId, 'c2');
    await c.setSchool('e1');
    expect(c.schoolClassId, isNull, reason: 'turma de outra escola sai');
    expect(c.classOptions.single.id, 'c1');
    expect(c.items.single.id, 'w1');
    await c.setPeriod(from: DateTime(2026, 9, 1), to: DateTime(2026, 9, 30));
    expect(repo.lastList?.from, DateTime(2026, 9, 1));
  });

  test('erro de carga vira estado de erro amigável', () async {
    final repo = _repo()
      ..failWith = const AppException(
        message: 'x',
        statusCode: 403,
        code: 'TENANT_OUT_OF_SCOPE',
      );
    final c = WeeklySchedulesListController(repo);
    await c.load();
    expect(c.state, WeeklySchedulesViewState.error);
    expect(c.error, contains('tenant'));
  });

  test('remove exclui e recarrega; 409 vira mensagem', () async {
    final repo = _repo();
    final c = WeeklySchedulesListController(repo);
    await c.load();
    expect(await c.remove(c.items.first), isNull);
    expect(repo.removedId, 'w1');
    expect(repo.calls.last, 'list');
    repo.failWith = const AppException(
      message: 'x',
      statusCode: 409,
      code: 'SCHEDULE_HAS_RECORDS',
    );
    expect(await c.remove(c.items.first), contains('registrados'));
  });

  test('replicação guarda o resumo e recarrega a lista', () async {
    final repo = _repo()
      ..replication = ReplicationOutcome(
        results: <ReplicationResult>[
          ReplicationResult(
            action: ReplicationAction.overwritten,
            schedule: _target('t1', DateTime(2026, 10, 5)),
            preserved: <ReplicatedLesson>[_replicated('2026-10-05')],
            discarded: <ReplicatedLesson>[
              _replicated('2026-10-06', DiscardReason.recordedConflict),
            ],
          ),
          ReplicationResult(
            action: ReplicationAction.created,
            schedule: _target('t2', DateTime(2026, 10, 12)),
            discarded: <ReplicatedLesson>[
              _replicated('2026-10-12', DiscardReason.nonSchoolDay),
            ],
          ),
        ],
      );
    final c = WeeklySchedulesListController(repo);
    await c.load();
    final targets = <DateTime>[DateTime(2026, 10, 5), DateTime(2026, 10, 12)];
    expect(await c.replicate(c.items.first, targets), isNull);
    expect(repo.replicated?.toJson()['targetStartDates'], <String>[
      '2026-10-05',
      '2026-10-12',
    ]);
    final outcome = c.lastReplication!;
    expect(outcome.overwrittenCount, 1);
    expect(outcome.createdCount, 1);
    expect(outcome.preservedCount, 1);
    expect(outcome.discardedCount, 2);
    expect(
      outcome.results.first.discarded.single.reason?.label,
      contains('registrada'),
    );
    expect(repo.calls.last, 'list');
  });
}
