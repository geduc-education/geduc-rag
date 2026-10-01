import 'package:flutter/widgets.dart';

import '../../../../core/theme/colors_app.dart';
import '../../data/models/calendar_event.dart';

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

/// Cabeçalho dos dias da semana, de domingo a sábado.
const List<String> calendarWeekdayLabels = <String>[
  'Dom.',
  'Seg.',
  'Ter.',
  'Qua.',
  'Qui.',
  'Sex.',
  'Sáb.',
];

/// Nome do mês de [date] (pt-BR).
String calendarMonthName(DateTime date) => calendarMonthNames[date.month - 1];

/// Cor de acento do [type]: faixa dos cards, dos registros e dos selos do dia.
extension CalendarEventTypeStyle on CalendarEventType {
  Color accent(BuildContext context) {
    final colors = context.colors;
    return switch (this) {
      CalendarEventType.pontoFacultativo => colors.warning500,
      CalendarEventType.diaLetivo => colors.success500,
      CalendarEventType.diaNaoLetivo => colors.danger500,
      CalendarEventType.planejamentoAula => colors.indigo500,
      CalendarEventType.formacaoPedagogica => colors.info500,
      CalendarEventType.evento => colors.neutral500,
    };
  }
}
