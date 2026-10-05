import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/modules/academic_calendar/data/models/calendar_day_type.dart';
import 'package:geduc_rag/modules/weekly_schedules/data/models/schedule_day.dart';
import 'package:geduc_rag/modules/weekly_schedules/data/models/schedule_lookups.dart';
import 'package:geduc_rag/modules/weekly_schedules/data/models/schedule_replication.dart';
import 'package:geduc_rag/modules/weekly_schedules/data/models/schedule_week.dart';
import 'package:geduc_rag/modules/weekly_schedules/data/models/weekly_schedule.dart';
import 'package:geduc_rag/modules/weekly_schedules/data/weekly_schedules_repository.dart';

/// Semana com segunda a sexta letivas, sábado [saturday] e domingo não
/// letivo — como o calendário padrão do backend.
List<ScheduleDay> fakeScheduleWeek(
  DateTime monday, {
  CalendarDayType saturday = CalendarDayType.nonSchoolDay,
}) => <ScheduleDay>[
  for (final date in scheduleWeekDates(monday))
    ScheduleDay(
      date: date,
      dayType: switch (date.weekday) {
        DateTime.saturday => saturday,
        DateTime.sunday => CalendarDayType.nonSchoolDay,
        _ => CalendarDayType.schoolDay,
      },
    ),
];

/// Repositório fake do horário semanal: registra as chamadas e devolve os
/// dados configurados; create/update ecoam os dias com ids nas aulas.
class FakeWeeklySchedulesRepository implements IWeeklySchedulesRepository {
  FakeWeeklySchedulesRepository({
    this.schedules = const <WeeklyScheduleSummary>[],
    this.schools = const <ScheduleSchool>[],
    this.classes = const <ScheduleClass>[],
    this.subjects = const <ScheduleSubject>[],
    this.slots = const <ScheduleLessonSlot>[],
    this.detail,
    this.replication,
    this.saturday = CalendarDayType.nonSchoolDay,
  });

  List<WeeklyScheduleSummary> schedules;
  List<ScheduleSchool> schools;
  List<ScheduleClass> classes;
  List<ScheduleSubject> subjects;
  List<ScheduleLessonSlot> slots;
  WeeklySchedule? detail;
  ReplicationOutcome? replication;
  CalendarDayType saturday;
  AppException? failWith;

  final List<String> calls = <String>[];
  ({String? schoolClassId, DateTime? from, DateTime? to, int page})? lastList;
  ({String schoolId, DateTime monday})? lastPreview;
  CreateWeeklyScheduleInput? created;
  UpdateWeeklyScheduleInput? updated;
  ReplicateWeeklyScheduleInput? replicated;
  LessonRecordUpdate? recordUpdate;
  String? removedId;
  String? lastSlotsSchoolId;

  void _maybeFail() {
    final error = failWith;
    if (error != null) throw error;
  }

  @override
  Future<WeeklySchedulesPage> list({
    String? schoolClassId,
    DateTime? from,
    DateTime? to,
    int page = 1,
    int limit = 20,
  }) async {
    calls.add('list');
    lastList = (schoolClassId: schoolClassId, from: from, to: to, page: page);
    _maybeFail();
    final items = schedules
        .where((s) => schoolClassId == null || s.schoolClassId == schoolClassId)
        .toList();
    return WeeklySchedulesPage(items: items, total: items.length);
  }

  @override
  Future<WeeklySchedule> getById(String id) async {
    calls.add('getById');
    _maybeFail();
    return detail!;
  }

  @override
  Future<WeeklySchedule> create(CreateWeeklyScheduleInput input) async {
    calls.add('create');
    _maybeFail();
    created = input;
    return _echo('new', input.schoolClassId, input.monday, input.days);
  }

  @override
  Future<WeeklySchedule> update(
    String id,
    UpdateWeeklyScheduleInput input,
  ) async {
    calls.add('update');
    _maybeFail();
    updated = input;
    final summary = detail!.summary;
    return _echo(id, summary.schoolClassId, summary.startDate, input.days);
  }

  @override
  Future<void> remove(String id) async {
    calls.add('remove');
    _maybeFail();
    removedId = id;
  }

  @override
  Future<ReplicationOutcome> replicate(
    String id,
    ReplicateWeeklyScheduleInput input,
  ) async {
    calls.add('replicate');
    _maybeFail();
    replicated = input;
    return replication ??
        const ReplicationOutcome(results: <ReplicationResult>[]);
  }

  @override
  Future<ScheduleLesson> updateLessonRecord(
    String scheduleId,
    String lessonId,
    LessonRecordUpdate input,
  ) async {
    calls.add('record');
    _maybeFail();
    recordUpdate = input;
    return ScheduleLesson(
      id: lessonId,
      lessonSlotId: 'slot',
      subjectId: 's',
      contentRecorded: input.contentRecorded ?? false,
      attendanceRecorded: input.attendanceRecorded ?? false,
    );
  }

  @override
  Future<List<ScheduleDay>> previewWeek(
    String schoolId,
    DateTime monday,
  ) async {
    calls.add('preview');
    lastPreview = (schoolId: schoolId, monday: monday);
    _maybeFail();
    return fakeScheduleWeek(monday, saturday: saturday);
  }

  @override
  Future<List<ScheduleSchool>> listSchools() async => schools;

  @override
  Future<List<ScheduleClass>> listClasses({String? schoolId}) async => classes;

  @override
  Future<ScheduleClass> getClass(String id) async {
    calls.add('getClass');
    return classes.firstWhere(
      (c) => c.id == id,
      orElse: () => ScheduleClass(id: id, name: '', schoolId: 'e1'),
    );
  }

  @override
  Future<List<ScheduleSubject>> listSubjects() async => subjects;

  @override
  Future<List<ScheduleLessonSlot>> listLessonSlots(String schoolId) async {
    calls.add('slots');
    lastSlotsSchoolId = schoolId;
    return slots;
  }

  WeeklySchedule _echo(
    String id,
    String classId,
    DateTime monday,
    List<ScheduleDay> days,
  ) {
    var n = 0;
    return WeeklySchedule(
      summary: WeeklyScheduleSummary(
        id: id,
        schoolClassId: classId,
        startDate: monday,
        status: ScheduleStatus.upToDate,
      ),
      days: <ScheduleDay>[
        for (final day in days)
          ScheduleDay(
            date: day.date,
            dayType: day.dayType,
            lessons: <ScheduleLesson>[
              for (final l in day.lessons)
                ScheduleLesson(
                  id: l.id ?? 'l${n++}',
                  lessonSlotId: l.lessonSlotId,
                  slotName: l.slotName,
                  subjectId: l.subjectId,
                  subjectName: l.subjectName,
                  startTime: l.startTime,
                  endTime: l.endTime,
                  contentRecorded: l.contentRecorded,
                  attendanceRecorded: l.attendanceRecorded,
                ),
            ],
          ),
      ],
    );
  }
}
