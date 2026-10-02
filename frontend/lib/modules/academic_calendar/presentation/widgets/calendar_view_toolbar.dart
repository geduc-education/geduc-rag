import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/colors_app.dart';
import '../../../../shared/components/buttons/app_segmented_button_style.dart';
import '../../../../shared/utils/app_date_formats.dart';
import '../../data/models/calendar_day_type.dart';
import 'calendar_day_type_style.dart';

/// Rótulo do período exibido em cada visão.
String calendarPeriodLabel(CalendarView view, DateTime start, DateTime end) =>
    switch (view) {
      CalendarView.day => '${calendarWeekdayName(start)}, ${formatDate(start)}',
      CalendarView.week => '${formatShortDate(start)} a ${formatDate(end)}',
      CalendarView.month => '${calendarMonthName(start)} de ${start.year}',
      CalendarView.year => '${start.year}',
    };

/// Seletor de visão (dia/semana/mês/ano) e navegação entre períodos.
/// [onPrevious]/[onNext] `null` = no limite do calendário.
class CalendarViewToolbar extends StatelessWidget {
  const CalendarViewToolbar({
    super.key,
    required this.view,
    required this.label,
    required this.onView,
    this.onPrevious,
    this.onNext,
  });

  final CalendarView view;
  final String label;
  final ValueChanged<CalendarView> onView;
  final VoidCallback? onPrevious;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppDimensions.gapLg,
      runSpacing: AppDimensions.gapSm,
      crossAxisAlignment: WrapCrossAlignment.center,
      alignment: WrapAlignment.spaceBetween,
      children: <Widget>[
        SegmentedButton<CalendarView>(
          style: appSegmentedButtonStyle(context),
          showSelectedIcon: false,
          segments: <ButtonSegment<CalendarView>>[
            for (final v in CalendarView.values)
              ButtonSegment<CalendarView>(value: v, label: Text(v.label)),
          ],
          selected: <CalendarView>{view},
          onSelectionChanged: (s) => onView(s.first),
        ),
        _PeriodNavigator(label: label, onPrevious: onPrevious, onNext: onNext),
      ],
    );
  }
}

class _PeriodNavigator extends StatelessWidget {
  const _PeriodNavigator({
    required this.label,
    required this.onPrevious,
    required this.onNext,
  });

  final String label;
  final VoidCallback? onPrevious;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        IconButton.outlined(
          tooltip: 'Período anterior',
          icon: const Icon(Icons.chevron_left),
          onPressed: onPrevious,
        ),
        AppDimensions.hGapSm,
        Text(
          label.toUpperCase(),
          style: context.textStyles.textTile16.copyWith(
            color: context.colors.textPrimary,
          ),
        ),
        AppDimensions.hGapSm,
        IconButton.outlined(
          tooltip: 'Próximo período',
          icon: const Icon(Icons.chevron_right),
          onPressed: onNext,
        ),
      ],
    );
  }
}
