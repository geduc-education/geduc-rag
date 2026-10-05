import '../../../../shared/utils/time_text.dart';

// Modelos mínimos dos dados auxiliares do horário (escolas, turmas,
// disciplinas e horários de aula), próprios deste módulo — só o que o
// horário precisa.

/// Escola do tenant (`GET /schools`).
class ScheduleSchool {
  const ScheduleSchool({required this.id, required this.name});

  final String id;
  final String name;

  factory ScheduleSchool.fromJson(Map<String, dynamic> json) => ScheduleSchool(
    id: json['id']?.toString() ?? '',
    name: json['name']?.toString() ?? '',
  );
}

/// Turma (`GET /school-classes`).
class ScheduleClass {
  const ScheduleClass({
    required this.id,
    required this.name,
    required this.schoolId,
    this.schoolYear,
  });

  final String id;
  final String name;
  final String schoolId;
  final int? schoolYear;

  /// Nome com o ano letivo, quando conhecido.
  String get label => schoolYear == null ? name : '$name ($schoolYear)';

  factory ScheduleClass.fromJson(Map<String, dynamic> json) => ScheduleClass(
    id: json['id']?.toString() ?? '',
    name: json['name']?.toString() ?? '',
    schoolId: json['schoolId']?.toString() ?? '',
    schoolYear: (json['schoolYear'] as num?)?.toInt(),
  );
}

/// Disciplina (`GET /subjects`).
class ScheduleSubject {
  const ScheduleSubject({
    required this.id,
    required this.name,
    this.active = true,
  });

  final String id;
  final String name;
  final bool active;

  factory ScheduleSubject.fromJson(Map<String, dynamic> json) =>
      ScheduleSubject(
        id: json['id']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        active: json['active'] != false,
      );
}

/// Horário de aula da escola (`GET /schools/:schoolId/lesson-slots`).
class ScheduleLessonSlot {
  const ScheduleLessonSlot({
    required this.id,
    required this.name,
    required this.startTime,
    required this.endTime,
  });

  final String id;
  final String name;
  final String startTime;
  final String endTime;

  /// `07:00–07:50`.
  String get timeRange => formatTimeRange(startTime, endTime);

  /// `1ª aula · 07:00–07:50`.
  String get label => '$name · $timeRange';

  factory ScheduleLessonSlot.fromJson(Map<String, dynamic> json) =>
      ScheduleLessonSlot(
        id: json['id']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        startTime: json['startTime']?.toString() ?? '',
        endTime: json['endTime']?.toString() ?? '',
      );
}

/// Lê os itens do envelope paginado `{ data, total }`.
List<T> scheduleItemsFromPage<T>(
  Map<String, dynamic> json,
  T Function(Map<String, dynamic>) fromJson,
) {
  final raw = json['data'];
  if (raw is! List) return List<T>.empty();
  return raw
      .whereType<Map<String, dynamic>>()
      .map(fromJson)
      .toList(growable: false);
}
