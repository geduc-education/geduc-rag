import '../../../../shared/utils/app_date_formats.dart';

// Regras de data do horário semanal: a semana vai sempre de segunda a
// domingo. Datas são meia-noite local; a aritmética usa o construtor de
// [DateTime] (imune a horário de verão).

/// Segunda-feira da semana que contém [date].
DateTime scheduleMondayOf(DateTime date) => DateTime(
  date.year,
  date.month,
  date.day - (date.weekday - DateTime.monday),
);

/// [date] + [days] dias, à meia-noite local.
DateTime scheduleAddDays(DateTime date, int days) =>
    DateTime(date.year, date.month, date.day + days);

/// Domingo que fecha a semana iniciada em [monday].
DateTime scheduleSundayOf(DateTime monday) => scheduleAddDays(monday, 6);

/// As 7 datas da semana iniciada em [monday] (segunda → domingo).
List<DateTime> scheduleWeekDates(DateTime monday) => <DateTime>[
  for (var i = 0; i < 7; i++) scheduleAddDays(monday, i),
];

/// `dd/MM a dd/MM` da semana iniciada em [monday].
String formatScheduleWeek(DateTime monday) =>
    '${formatShortDate(monday)} a ${formatShortDate(scheduleSundayOf(monday))}';
