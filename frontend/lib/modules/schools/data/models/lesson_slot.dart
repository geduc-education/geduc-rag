import '../../../../shared/utils/time_text.dart';

/// Horário de aula da escola (`LessonSlotResponseDto`): nome ("1ª aula") e
/// intervalo `HH:mm`. A API devolve a lista já ordenada. Serialização manual.
class LessonSlot {
  const LessonSlot({
    required this.id,
    required this.schoolId,
    required this.name,
    required this.startTime,
    required this.endTime,
    this.position = 0,
  });

  final String id;
  final String schoolId;
  final String name;
  final String startTime;
  final String endTime;
  final int position;

  /// `07:00–07:50`.
  String get timeRange => formatTimeRange(startTime, endTime);

  factory LessonSlot.fromJson(Map<String, dynamic> json) => LessonSlot(
    id: json['id']?.toString() ?? '',
    schoolId: json['schoolId']?.toString() ?? '',
    name: json['name']?.toString() ?? '',
    startTime: json['startTime']?.toString() ?? '',
    endTime: json['endTime']?.toString() ?? '',
    position: (json['position'] as num?)?.toInt() ?? 0,
  );

  /// Lê o envelope `{ data: LessonSlot[] }`, preservando a ordem da API.
  static List<LessonSlot> listFromJson(Map<String, dynamic> json) {
    final raw = json['data'];
    if (raw is! List) return const <LessonSlot>[];
    return raw
        .whereType<Map<String, dynamic>>()
        .map(LessonSlot.fromJson)
        .toList(growable: false);
  }
}

/// Payload de `POST /schools/:schoolId/lesson-slots` e do `PATCH` (que aceita
/// corpo parcial; aqui sempre vão nome e horas). [position] `null` não vai.
class LessonSlotInput {
  const LessonSlotInput({
    required this.name,
    required this.startTime,
    required this.endTime,
    this.position,
  });

  final String name;
  final String startTime;
  final String endTime;
  final int? position;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'name': name.trim(),
    'startTime': startTime.trim(),
    'endTime': endTime.trim(),
    'position': ?position,
  };
}
