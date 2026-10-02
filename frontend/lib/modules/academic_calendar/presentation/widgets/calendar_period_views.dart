import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/colors_app.dart';
import '../../../../shared/components/buttons/app_secondary_button.dart';
import '../../../../shared/components/feedback/app_state_views.dart';
import '../../../../shared/components/responsive/breakpoints.dart';
import '../../../../shared/utils/app_date_formats.dart';
import '../../data/models/calendar_day.dart';
import '../../data/models/calendar_day_type.dart';
import 'calendar_accent_card.dart';
import 'calendar_day_cell.dart';
import 'calendar_day_type_style.dart';
import 'calendar_month_grid.dart';

/// Visão semana: os sete dias (domingo a sábado) a partir de [start].
class CalendarWeekStrip extends StatelessWidget {
  const CalendarWeekStrip({
    super.key,
    required this.start,
    required this.dayOn,
    this.onTapDay,
    this.today,
  });

  /// Domingo da semana.
  final DateTime start;
  final CalendarDayLookup dayOn;
  final ValueChanged<CalendarDay>? onTapDay;
  final DateTime? today;

  @override
  Widget build(BuildContext context) {
    final now = today ?? DateTime.now();
    final dates = <DateTime>[
      for (var i = 0; i < 7; i++)
        DateTime(start.year, start.month, start.day + i),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        const CalendarWeekdayRow(),
        AppDimensions.vGapXs,
        Row(
          children: <Widget>[
            for (final date in dates)
              Expanded(
                child: CalendarDayCell(
                  date: date,
                  day: dayOn(date),
                  isToday: isSameCalendarDay(date, now),
                  onTap: onTapDay,
                ),
              ),
          ],
        ),
      ],
    );
  }
}

/// Visão dia: o dia com tipo, descrição e a ação de edição.
class CalendarDayDetail extends StatelessWidget {
  const CalendarDayDetail({super.key, required this.day, this.onEdit});

  /// `null` = data fora do período do calendário.
  final CalendarDay? day;
  final ValueChanged<CalendarDay>? onEdit;

  @override
  Widget build(BuildContext context) {
    final info = day;
    if (info == null) {
      return const AppEmptyView(
        message: 'Este dia está fora do período do calendário.',
        icon: Icons.event_busy_outlined,
      );
    }
    final edit = onEdit;
    return CalendarAccentCard(
      accent: info.type.accent(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          _DayDetailText(day: info),
          if (edit != null) ...<Widget>[
            AppDimensions.vGapLg,
            AppSecondaryButton(
              label: 'Editar dia',
              icon: Icons.edit_outlined,
              onPressed: () => edit(info),
            ),
          ],
        ],
      ),
    );
  }
}

class _DayDetailText extends StatelessWidget {
  const _DayDetailText({required this.day});

  final CalendarDay day;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final styles = context.textStyles;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          '${calendarWeekdayName(day.date)}, ${formatDate(day.date)}',
          style: styles.textRegularBold.copyWith(color: colors.textPrimary),
        ),
        AppDimensions.vGapXs,
        Text(
          day.type.label,
          style: styles.textSmallBold.copyWith(color: day.type.accent(context)),
        ),
        AppDimensions.vGapSm,
        Text(
          day.description ?? 'Sem descrição.',
          style: styles.textSmall.copyWith(color: colors.textSecondary),
        ),
      ],
    );
  }
}

/// Visão ano: os doze meses compactos. Tocar no nome abre o mês; tocar no
/// dia abre a edição.
class CalendarYearGrid extends StatelessWidget {
  const CalendarYearGrid({
    super.key,
    required this.year,
    required this.dayOn,
    required this.onOpenMonth,
    this.onTapDay,
    this.today,
  });

  final int year;
  final CalendarDayLookup dayOn;
  final ValueChanged<DateTime> onOpenMonth;
  final ValueChanged<CalendarDay>? onTapDay;
  final DateTime? today;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final breakpoint = AppBreakpoints.fromConstraints(constraints);
        final perRow = breakpoint.isDesktop ? 4 : (breakpoint.isTablet ? 3 : 1);
        const gap = AppDimensions.gapLg;
        final width = (constraints.maxWidth - gap * (perRow - 1)) / perRow;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: <Widget>[
            for (var month = 1; month <= 12; month++)
              SizedBox(
                width: width,
                child: _MiniMonth(
                  month: DateTime(year, month),
                  dayOn: dayOn,
                  onOpen: onOpenMonth,
                  onTapDay: onTapDay,
                  today: today,
                ),
              ),
          ],
        );
      },
    );
  }
}

class _MiniMonth extends StatelessWidget {
  const _MiniMonth({
    required this.month,
    required this.dayOn,
    required this.onOpen,
    required this.onTapDay,
    required this.today,
  });

  final DateTime month;
  final CalendarDayLookup dayOn;
  final ValueChanged<DateTime> onOpen;
  final ValueChanged<CalendarDay>? onTapDay;
  final DateTime? today;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        TextButton(
          onPressed: () => onOpen(month),
          child: Text(
            calendarMonthName(month).toUpperCase(),
            style: context.textStyles.textSmallBold.copyWith(
              color: context.colors.textPrimary,
            ),
          ),
        ),
        CalendarMonthGrid(
          month: month,
          dayOn: dayOn,
          onTapDay: onTapDay,
          today: today,
          compact: true,
        ),
      ],
    );
  }
}
