import 'calendar_day_type.dart';

/// Quantitativo de dias por tipo (`totals` da API) — de um calendário ou do
/// período de uma visão.
class DayTypeTotals {
  const DayTypeTotals({
    this.counts = const <CalendarDayType, int>{},
    this.total = 0,
  });

  static const DayTypeTotals empty = DayTypeTotals();

  final Map<CalendarDayType, int> counts;
  final int total;

  int countOf(CalendarDayType type) => counts[type] ?? 0;

  factory DayTypeTotals.fromJson(Map<String, dynamic> json) => DayTypeTotals(
    counts: <CalendarDayType, int>{
      for (final type in CalendarDayType.values)
        type: (json[type.code] as num?)?.toInt() ?? 0,
    },
    total: (json['total'] as num?)?.toInt() ?? 0,
  );

  Map<String, dynamic> toJson() => <String, dynamic>{
    for (final type in CalendarDayType.values) type.code: countOf(type),
    'total': total,
  };
}
