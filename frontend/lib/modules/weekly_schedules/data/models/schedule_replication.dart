import '../../../academic_calendar/data/models/calendar_day_type.dart';
import 'weekly_schedule.dart';

/// O que a replicação fez na semana alvo.
enum ReplicationAction {
  created('CREATED', 'Criada'),
  overwritten('OVERWRITTEN', 'Sobrescrita');

  const ReplicationAction(this.code, this.label);

  final String code;
  final String label;

  static ReplicationAction fromCode(Object? code) => values.firstWhere(
    (a) => a.code == code,
    orElse: () => ReplicationAction.created,
  );
}

/// Por que uma aula replicada foi descartada.
enum DiscardReason {
  nonSchoolDay('NON_SCHOOL_DAY', 'Dia não letivo na semana alvo'),
  recordedConflict(
    'RECORDED_CONFLICT',
    'Conflita com aula já registrada na semana alvo',
  );

  const DiscardReason(this.code, this.label);

  final String code;
  final String label;

  static DiscardReason fromCode(Object? code) => values.firstWhere(
    (r) => r.code == code,
    orElse: () => DiscardReason.nonSchoolDay,
  );
}

/// Aula preservada ou descartada na replicação (copia o horário de aula
/// [lessonSlotId]); [reason] só no descarte.
class ReplicatedLesson {
  const ReplicatedLesson({
    required this.date,
    required this.subjectId,
    required this.startTime,
    required this.endTime,
    this.lessonSlotId = '',
    this.slotName = '',
    this.reason,
  });

  final DateTime date;
  final String lessonSlotId;
  final String slotName;
  final String subjectId;
  final String startTime;
  final String endTime;
  final DiscardReason? reason;

  factory ReplicatedLesson.fromJson(Map<String, dynamic> json) =>
      ReplicatedLesson(
        date: parseCalendarWireDate(json['date']) ?? DateTime(1970),
        lessonSlotId: json['lessonSlotId']?.toString() ?? '',
        slotName: json['slotName']?.toString() ?? '',
        subjectId: json['subjectId']?.toString() ?? '',
        startTime: json['startTime']?.toString() ?? '',
        endTime: json['endTime']?.toString() ?? '',
        reason: json['reason'] == null
            ? null
            : DiscardReason.fromCode(json['reason']),
      );

  static List<ReplicatedLesson> listFrom(Object? raw) => raw is List
      ? raw
            .whereType<Map<String, dynamic>>()
            .map(ReplicatedLesson.fromJson)
            .toList(growable: false)
      : const <ReplicatedLesson>[];
}

/// Resultado de uma semana alvo (`ReplicationResultDto`).
class ReplicationResult {
  const ReplicationResult({
    required this.action,
    required this.schedule,
    this.preserved = const <ReplicatedLesson>[],
    this.discarded = const <ReplicatedLesson>[],
  });

  final ReplicationAction action;
  final WeeklySchedule schedule;
  final List<ReplicatedLesson> preserved;
  final List<ReplicatedLesson> discarded;

  factory ReplicationResult.fromJson(Map<String, dynamic> json) {
    final raw = json['schedule'];
    return ReplicationResult(
      action: ReplicationAction.fromCode(json['action']),
      schedule: WeeklySchedule.fromJson(
        raw is Map<String, dynamic> ? raw : const <String, dynamic>{},
      ),
      preserved: ReplicatedLesson.listFrom(json['preserved']),
      discarded: ReplicatedLesson.listFrom(json['discarded']),
    );
  }
}

/// Resposta da replicação: um resultado por semana alvo, na ordem enviada.
class ReplicationOutcome {
  const ReplicationOutcome({required this.results});

  final List<ReplicationResult> results;

  int get createdCount =>
      results.where((r) => r.action == ReplicationAction.created).length;
  int get overwrittenCount =>
      results.where((r) => r.action == ReplicationAction.overwritten).length;
  int get preservedCount =>
      results.fold(0, (sum, r) => sum + r.preserved.length);
  int get discardedCount =>
      results.fold(0, (sum, r) => sum + r.discarded.length);

  factory ReplicationOutcome.fromJson(Map<String, dynamic> json) {
    final raw = json['data'];
    return ReplicationOutcome(
      results: raw is List
          ? raw
                .whereType<Map<String, dynamic>>()
                .map(ReplicationResult.fromJson)
                .toList(growable: false)
          : const <ReplicationResult>[],
    );
  }
}

/// Payload de `POST /weekly-schedules/:id/replicate`.
class ReplicateWeeklyScheduleInput {
  const ReplicateWeeklyScheduleInput({required this.targetMondays});

  final List<DateTime> targetMondays;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'targetStartDates': targetMondays
        .map(formatCalendarWireDate)
        .toList(growable: false),
  };
}
