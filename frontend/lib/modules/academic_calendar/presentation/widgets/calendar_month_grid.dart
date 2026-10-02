import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/colors_app.dart';
import '../../data/models/calendar_day.dart';
import '../../data/models/calendar_day_type.dart';
import 'calendar_day_cell.dart';
import 'calendar_day_type_style.dart';

/// Busca o dia carregado de uma data; `null` = fora do calendário/período.
typedef CalendarDayLookup = CalendarDay? Function(DateTime date);

/// Grade mensal (domingo a sábado) com cada dia na cor do seu tipo. Em
/// [compact] vira o mini-mês da visão ano.
class CalendarMonthGrid extends StatelessWidget {
  const CalendarMonthGrid({
    super.key,
    required this.month,
    required this.dayOn,
    this.onTapDay,
    this.today,
    this.compact = false,
  });

  /// Qualquer dia do mês exibido.
  final DateTime month;
  final CalendarDayLookup dayOn;
  final ValueChanged<CalendarDay>? onTapDay;

  /// Dia destacado como "hoje"; `null` usa a data do dispositivo.
  final DateTime? today;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final first = DateTime(month.year, month.month);
    final leading = first.weekday % 7;
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    final weeks = ((leading + daysInMonth) / 7).ceil();
    final now = today ?? DateTime.now();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        CalendarWeekdayRow(compact: compact),
        AppDimensions.vGapXs,
        for (var week = 0; week < weeks; week++)
          Row(
            children: <Widget>[
              for (var col = 0; col < 7; col++)
                Expanded(
                  child: _MonthCell(
                    month: first,
                    dayOfMonth: week * 7 + col - leading + 1,
                    dayOn: dayOn,
                    onTap: onTapDay,
                    today: now,
                    compact: compact,
                  ),
                ),
            ],
          ),
      ],
    );
  }
}

/// Célula da grade: preenchimento fora do mês ou o dia com seu tipo.
class _MonthCell extends StatelessWidget {
  const _MonthCell({
    required this.month,
    required this.dayOfMonth,
    required this.dayOn,
    required this.onTap,
    required this.today,
    required this.compact,
  });

  final DateTime month;
  final int dayOfMonth;
  final CalendarDayLookup dayOn;
  final ValueChanged<CalendarDay>? onTap;
  final DateTime today;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    if (dayOfMonth < 1 || dayOfMonth > daysInMonth) {
      return CalendarDayCell(date: null, day: null, compact: compact);
    }
    final date = DateTime(month.year, month.month, dayOfMonth);
    return CalendarDayCell(
      date: date,
      day: dayOn(date),
      isToday: isSameCalendarDay(date, today),
      compact: compact,
      onTap: onTap,
    );
  }
}

/// Cabeçalho dos dias da semana (domingo a sábado).
class CalendarWeekdayRow extends StatelessWidget {
  const CalendarWeekdayRow({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    final style = context.textStyles.textVerySmallBold.copyWith(
      color: context.colors.info500,
    );
    return Row(
      children: <Widget>[
        for (final label in calendarWeekdayLabels)
          Expanded(
            child: Text(
              compact ? label.substring(0, 1) : label.toUpperCase(),
              textAlign: TextAlign.center,
              style: style,
            ),
          ),
      ],
    );
  }
}
