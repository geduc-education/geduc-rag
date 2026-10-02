import 'package:flutter/widgets.dart';

import '../../../../core/theme/colors_app.dart';
import '../../data/models/calendar_day_type.dart';

/// Nomes dos meses (pt-BR) — sem `initializeDateFormatting`, ver
/// `app_date_formats.dart`.
const List<String> calendarMonthNames = <String>[
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/// Cabeçalho dos dias da semana, de domingo a sábado (índice = `weekday`).
const List<String> calendarWeekdayLabels = <String>[
  'Dom.',
  'Seg.',
  'Ter.',
  'Qua.',
  'Qui.',
  'Sex.',
  'Sáb.',
];

/// Nome completo do dia da semana, de domingo a sábado.
const List<String> calendarWeekdayNames = <String>[
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

/// Nome do mês de [date] (pt-BR).
String calendarMonthName(DateTime date) => calendarMonthNames[date.month - 1];

/// Nome do dia da semana de [date] (pt-BR).
String calendarWeekdayName(DateTime date) =>
    calendarWeekdayNames[date.weekday % 7];

/// Cores do [CalendarDayType], sempre via tokens do tema.
extension CalendarDayTypeStyle on CalendarDayType {
  /// Cor forte: faixa dos cards, legenda e selo do dia.
  Color accent(BuildContext context) {
    final colors = context.colors;
    return switch (this) {
      CalendarDayType.schoolDay => colors.success500,
      CalendarDayType.nonSchoolDay => colors.danger500,
      CalendarDayType.optionalDay => colors.warning500,
      CalendarDayType.lessonPlanning => colors.indigo500,
      CalendarDayType.teacherTraining => colors.info500,
    };
  }

  /// Cor suave: fundo da célula do dia na grade.
  Color tint(BuildContext context) {
    final colors = context.colors;
    return switch (this) {
      CalendarDayType.schoolDay => colors.success50,
      CalendarDayType.nonSchoolDay => colors.danger50,
      CalendarDayType.optionalDay => colors.warning50,
      CalendarDayType.lessonPlanning => colors.indigo50,
      CalendarDayType.teacherTraining => colors.info50,
    };
  }
}
