import '../../../academic_calendar/data/models/calendar_day_type.dart';
import 'schedule_day.dart';
import 'schedule_week.dart';

/// Situação do horário: `OUTDATED` quando o calendário mudou depois de
/// salvar.
enum ScheduleStatus {
  upToDate('UP_TO_DATE', 'Atualizado'),
  outdated('OUTDATED', 'Desatualizado');

  const ScheduleStatus(this.code, this.label);

  final String code;
  final String label;

  static ScheduleStatus fromCode(Object? code) => values.firstWhere(
    (s) => s.code == code,
    orElse: () => ScheduleStatus.upToDate,
  );
}

/// Contagem de aulas e registros do horário.
class ScheduleRecordSummary {
  const ScheduleRecordSummary({
    this.lessons = 0,
    this.contentRecorded = 0,
    this.attendanceRecorded = 0,
  });

  final int lessons;
  final int contentRecorded;
  final int attendanceRecorded;

  bool get hasRecords => contentRecorded > 0 || attendanceRecorded > 0;

  factory ScheduleRecordSummary.fromJson(Map<String, dynamic> json) =>
      ScheduleRecordSummary(
        lessons: (json['lessons'] as num?)?.toInt() ?? 0,
        contentRecorded: (json['contentRecorded'] as num?)?.toInt() ?? 0,
        attendanceRecorded: (json['attendanceRecorded'] as num?)?.toInt() ?? 0,
      );
}

/// Item da listagem (`WeeklyScheduleSummaryResponseDto`).
class WeeklyScheduleSummary {
  const WeeklyScheduleSummary({
    required this.id,
    required this.schoolClassId,
    required this.startDate,
    required this.status,
    this.record = const ScheduleRecordSummary(),
    this.createdAt,
  });

  final String id;
  final String schoolClassId;

  /// Segunda-feira da semana (meia-noite local).
  final DateTime startDate;
  final ScheduleStatus status;
  final ScheduleRecordSummary record;
  final DateTime? createdAt;

  DateTime get endDate => scheduleSundayOf(startDate);
  String get periodLabel => formatScheduleWeek(startDate);

  factory WeeklyScheduleSummary.fromJson(Map<String, dynamic> json) =>
      WeeklyScheduleSummary(
        id: json['id']?.toString() ?? '',
        schoolClassId: json['schoolClassId']?.toString() ?? '',
        startDate: parseCalendarWireDate(json['startDate']) ?? DateTime(1970),
        status: ScheduleStatus.fromCode(json['status']),
        record: _record(json['record']),
        createdAt: _timestamp(json['createdAt']),
      );

  static ScheduleRecordSummary _record(Object? raw) =>
      raw is Map<String, dynamic>
      ? ScheduleRecordSummary.fromJson(raw)
      : const ScheduleRecordSummary();

  static DateTime? _timestamp(Object? raw) =>
      raw == null ? null : DateTime.tryParse(raw.toString())?.toLocal();
}

/// Horário completo, com os 7 dias e as aulas (`WeeklyScheduleResponseDto`).
class WeeklySchedule {
  const WeeklySchedule({required this.summary, required this.days});

  final WeeklyScheduleSummary summary;
  final List<ScheduleDay> days;

  String get id => summary.id;

  factory WeeklySchedule.fromJson(Map<String, dynamic> json) {
    final raw = json['days'];
    return WeeklySchedule(
      summary: WeeklyScheduleSummary.fromJson(json),
      days: raw is List
          ? raw
                .whereType<Map<String, dynamic>>()
                .map(ScheduleDay.fromJson)
                .toList(growable: false)
          : const <ScheduleDay>[],
    );
  }
}

/// Página da listagem (`{ data, total }`).
class WeeklySchedulesPage {
  const WeeklySchedulesPage({required this.items, required this.total});

  final List<WeeklyScheduleSummary> items;
  final int total;

  factory WeeklySchedulesPage.fromJson(Map<String, dynamic> json) {
    final raw = json['data'];
    return WeeklySchedulesPage(
      items: raw is List
          ? raw
                .whereType<Map<String, dynamic>>()
                .map(WeeklyScheduleSummary.fromJson)
                .toList(growable: false)
          : const <WeeklyScheduleSummary>[],
      total: (json['total'] as num?)?.toInt() ?? 0,
    );
  }
}

/// Payload de `POST /weekly-schedules`: semana de segunda a domingo.
class CreateWeeklyScheduleInput {
  const CreateWeeklyScheduleInput({
    required this.schoolClassId,
    required this.monday,
    required this.days,
  });

  final String schoolClassId;
  final DateTime monday;
  final List<ScheduleDay> days;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'schoolClassId': schoolClassId,
    'startDate': formatCalendarWireDate(monday),
    'endDate': formatCalendarWireDate(scheduleSundayOf(monday)),
    'days': days.map((d) => d.toJson()).toList(growable: false),
  };
}

/// Payload de `PUT /weekly-schedules/:id`: substitui os dias.
class UpdateWeeklyScheduleInput {
  const UpdateWeeklyScheduleInput({required this.days});

  final List<ScheduleDay> days;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'days': days.map((d) => d.toJson()).toList(growable: false),
  };
}

/// Payload de `PATCH .../lessons/:lessonId/record`; `null` não é enviado.
class LessonRecordUpdate {
  const LessonRecordUpdate({this.contentRecorded, this.attendanceRecorded});

  final bool? contentRecorded;
  final bool? attendanceRecorded;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'contentRecorded': ?contentRecorded,
    'attendanceRecorded': ?attendanceRecorded,
  };
}
