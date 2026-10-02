import 'calendar_day_type.dart';
import 'day_type_totals.dart';

/// Dia do calendário (`CalendarDayResponseDto`).
class CalendarDay {
  const CalendarDay({
    required this.date,
    required this.weekday,
    required this.type,
    this.description,
    this.updatedAt,
  });

  /// Meia-noite local do dia.
  final DateTime date;

  /// 0 = domingo … 6 = sábado (convenção da API).
  final int weekday;
  final CalendarDayType type;
  final String? description;
  final DateTime? updatedAt;

  /// Domingo é sempre não letivo: só a descrição pode mudar.
  bool get isSunday => weekday == 0;

  factory CalendarDay.fromJson(Map<String, dynamic> json) {
    final date = parseCalendarWireDate(json['date']) ?? DateTime(1970);
    return CalendarDay(
      date: date,
      weekday: (json['weekday'] as num?)?.toInt() ?? date.weekday % 7,
      type:
          CalendarDayType.fromCode(json['type']) ??
          CalendarDayType.nonSchoolDay,
      description: json['description']?.toString(),
      updatedAt: json['updatedAt'] == null
          ? null
          : DateTime.tryParse(json['updatedAt'].toString()),
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'date': formatCalendarWireDate(date),
    'weekday': weekday,
    'type': type.code,
    'description': description,
    'updatedAt': ?updatedAt?.toIso8601String(),
  };
}

/// Dias de uma visão (`GET /academic-calendars/:id/days`) com o quantitativo
/// por tipo do período.
class CalendarDaysPeriod {
  const CalendarDaysPeriod({
    required this.calendarId,
    required this.view,
    required this.startDate,
    required this.endDate,
    this.days = const <CalendarDay>[],
    this.totals = DayTypeTotals.empty,
  });

  final String calendarId;
  final CalendarView view;
  final DateTime startDate;
  final DateTime endDate;
  final List<CalendarDay> days;
  final DayTypeTotals totals;

  factory CalendarDaysPeriod.fromJson(Map<String, dynamic> json) {
    final raw = json['days'];
    final rawTotals = json['totals'];
    final start = parseCalendarWireDate(json['startDate']) ?? DateTime(1970);
    return CalendarDaysPeriod(
      calendarId: json['calendarId']?.toString() ?? '',
      view: CalendarView.fromCode(json['view']),
      startDate: start,
      endDate: parseCalendarWireDate(json['endDate']) ?? start,
      days: raw is List
          ? raw
                .whereType<Map<String, dynamic>>()
                .map(CalendarDay.fromJson)
                .toList(growable: false)
          : const <CalendarDay>[],
      totals: rawTotals is Map<String, dynamic>
          ? DayTypeTotals.fromJson(rawTotals)
          : DayTypeTotals.empty,
    );
  }
}

/// Payload de `PATCH /academic-calendars/:id/days/:date`. [description]
/// vazia vai como `null` (limpa); [type] `null` não é enviado.
class CalendarDayUpdate {
  const CalendarDayUpdate({this.type, this.description});

  final CalendarDayType? type;
  final String? description;

  Map<String, dynamic> toJson() {
    final text = description?.trim() ?? '';
    return <String, dynamic>{
      'type': ?type?.code,
      'description': text.isEmpty ? null : text,
    };
  }
}
