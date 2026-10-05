import '../../../academic_calendar/data/models/calendar_day.dart';
import '../../../academic_calendar/data/models/calendar_day_type.dart';
import 'schedule_day.dart';
import 'schedule_week.dart';

/// Dias de um calendário acadêmico aplicável à escola, usados para prever o
/// tipo de cada dia de uma semana ainda não salva. [specific] = calendário
/// vinculado à escola (não "todas as escolas").
class CalendarWeekSource {
  const CalendarWeekSource({
    required this.calendarId,
    required this.specific,
    required this.days,
  });

  final String calendarId;
  final bool specific;
  final List<CalendarDay> days;

  CalendarDay? dayOn(DateTime date) =>
      days.where((d) => isSameCalendarDay(d.date, date)).firstOrNull;
}

/// Mesma resolução do backend (`resolveCalendarDays`): o calendário da
/// escola prevalece sobre o geral; empate → menor `calendarId`. Data sem
/// calendário fica com tipo `null`.
List<ScheduleDay> resolveScheduleWeek(
  DateTime monday,
  List<CalendarWeekSource> sources,
) {
  return scheduleWeekDates(monday)
      .map((date) => ScheduleDay(date: date, dayType: _typeOn(date, sources)))
      .toList(growable: false);
}

CalendarDayType? _typeOn(DateTime date, List<CalendarWeekSource> sources) {
  CalendarWeekSource? best;
  CalendarDay? bestDay;
  for (final source in sources) {
    final day = source.dayOn(date);
    if (day == null) continue;
    if (best == null || _prefer(source, best)) {
      best = source;
      bestDay = day;
    }
  }
  return bestDay?.type;
}

bool _prefer(CalendarWeekSource a, CalendarWeekSource b) {
  if (a.specific != b.specific) return a.specific;
  return a.calendarId.compareTo(b.calendarId) < 0;
}
