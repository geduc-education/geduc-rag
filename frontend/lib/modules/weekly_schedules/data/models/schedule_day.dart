import '../../../../shared/utils/time_text.dart';
import '../../../academic_calendar/data/models/calendar_day_type.dart';

/// Aula do horário (`ScheduleLessonResponseDto`). [id] `null` = aula ainda
/// não salva. A aula ocupa um horário de aula da escola ([lessonSlotId]);
/// [slotName] e as horas `HH:mm` vêm do horário (só leitura).
class ScheduleLesson {
  const ScheduleLesson({
    required this.lessonSlotId,
    required this.subjectId,
    this.id,
    this.slotName = '',
    this.startTime = '',
    this.endTime = '',
    this.subjectName = '',
    this.contentRecorded = false,
    this.attendanceRecorded = false,
  });

  final String? id;
  final String lessonSlotId;
  final String slotName;
  final String startTime;
  final String endTime;
  final String subjectId;
  final String subjectName;
  final bool contentRecorded;
  final bool attendanceRecorded;

  /// Com conteúdo ou frequência registrados: não pode mudar nem sair.
  bool get isRecorded => contentRecorded || attendanceRecorded;

  /// `07:00–07:50`.
  String get timeRange => formatTimeRange(startTime, endTime);

  ScheduleLesson copyWith({bool? contentRecorded, bool? attendanceRecorded}) =>
      ScheduleLesson(
        id: id,
        lessonSlotId: lessonSlotId,
        slotName: slotName,
        startTime: startTime,
        endTime: endTime,
        subjectId: subjectId,
        subjectName: subjectName,
        contentRecorded: contentRecorded ?? this.contentRecorded,
        attendanceRecorded: attendanceRecorded ?? this.attendanceRecorded,
      );

  factory ScheduleLesson.fromJson(Map<String, dynamic> json) => ScheduleLesson(
    id: json['id']?.toString(),
    lessonSlotId: json['lessonSlotId']?.toString() ?? '',
    slotName: json['slotName']?.toString() ?? '',
    startTime: json['startTime']?.toString() ?? '',
    endTime: json['endTime']?.toString() ?? '',
    subjectId: json['subjectId']?.toString() ?? '',
    subjectName: json['subjectName']?.toString() ?? '',
    contentRecorded: json['contentRecorded'] == true,
    attendanceRecorded: json['attendanceRecorded'] == true,
  );

  /// Payload de `ScheduleLessonDto` (POST/PUT).
  Map<String, dynamic> toJson() => <String, dynamic>{
    'lessonSlotId': lessonSlotId,
    'subjectId': subjectId,
  };
}

/// Ordem das aulas do dia: pelo início do horário; empate pelo nome.
int compareScheduleLessons(ScheduleLesson a, ScheduleLesson b) {
  final byTime = a.startTime.compareTo(b.startTime);
  return byTime != 0 ? byTime : a.slotName.compareTo(b.slotName);
}

/// Dia da semana do horário (`ScheduleDayResponseDto`). [dayType] `null` =
/// data fora de qualquer calendário. Só dia letivo ([hasClass]) aceita aula.
class ScheduleDay {
  const ScheduleDay({
    required this.date,
    required this.dayType,
    this.lessons = const <ScheduleLesson>[],
  });

  /// Meia-noite local.
  final DateTime date;
  final CalendarDayType? dayType;
  final List<ScheduleLesson> lessons;

  /// 0 = domingo … 6 = sábado (convenção da API).
  int get weekday => date.weekday % 7;
  bool get hasClass => dayType == CalendarDayType.schoolDay;
  bool get isSaturday => weekday == 6;

  /// Sábado letivo sem aula: bloqueia o salvamento.
  bool get needsLesson => isSaturday && hasClass && lessons.isEmpty;

  /// Rótulo do tipo do dia; fora do calendário quando `null`.
  String get typeLabel => dayType?.label ?? 'Fora do calendário';

  ScheduleDay withLessons(List<ScheduleLesson> lessons) => ScheduleDay(
    date: date,
    dayType: dayType,
    lessons: List<ScheduleLesson>.unmodifiable(
      <ScheduleLesson>[...lessons]..sort(compareScheduleLessons),
    ),
  );

  factory ScheduleDay.fromJson(Map<String, dynamic> json) {
    final raw = json['lessons'];
    return ScheduleDay(
      date: parseCalendarWireDate(json['date']) ?? DateTime(1970),
      dayType: CalendarDayType.fromCode(json['dayType']),
      lessons: raw is List
          ? raw
                .whereType<Map<String, dynamic>>()
                .map(ScheduleLesson.fromJson)
                .toList(growable: false)
          : const <ScheduleLesson>[],
    );
  }

  /// Payload de `ScheduleDayDto` (POST/PUT).
  Map<String, dynamic> toJson() => <String, dynamic>{
    'date': formatCalendarWireDate(date),
    'lessons': lessons.map((l) => l.toJson()).toList(growable: false),
  };
}
