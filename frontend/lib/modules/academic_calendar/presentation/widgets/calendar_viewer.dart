import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/colors_app.dart';
import '../../../../shared/components/feedback/app_state_views.dart';
import '../../data/models/calendar_day.dart';
import '../../data/models/calendar_day_type.dart';
import '../calendar_days_controller.dart';
import 'calendar_month_grid.dart';
import 'calendar_panel.dart';
import 'calendar_period_views.dart';
import 'calendar_summary_row.dart';
import 'calendar_view_toolbar.dart';

/// Calendário aberto: quantitativo do período por tipo, seletor de visão,
/// navegação e o corpo da visão (dia, semana, mês ou ano).
class CalendarViewer extends StatelessWidget {
  const CalendarViewer({
    super.key,
    required this.controller,
    required this.onEditDay,
    this.today,
  });

  final CalendarDaysController controller;
  final ValueChanged<CalendarDay> onEditDay;

  /// Dia destacado como "hoje"; `null` usa a data do dispositivo.
  final DateTime? today;

  @override
  Widget build(BuildContext context) {
    final calendar = controller.calendar;
    if (calendar == null) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(
          'Quantitativo do período',
          style: context.textStyles.textSmallBold.copyWith(
            color: context.colors.textSecondary,
          ),
        ),
        AppDimensions.vGapSm,
        CalendarSummaryRow(totals: controller.totals),
        AppDimensions.vGapXl,
        CalendarPanel(
          title: calendar.name,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              _ViewerToolbar(controller: controller),
              AppDimensions.vGapLg,
              _ViewerBody(
                controller: controller,
                onEditDay: onEditDay,
                today: today,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ViewerToolbar extends StatelessWidget {
  const _ViewerToolbar({required this.controller});

  final CalendarDaysController controller;

  @override
  Widget build(BuildContext context) {
    final period = controller.period;
    return CalendarViewToolbar(
      view: controller.view,
      label: period == null
          ? ''
          : calendarPeriodLabel(period.view, period.startDate, period.endDate),
      onView: controller.setView,
      onPrevious: controller.canGoPrevious ? controller.previous : null,
      onNext: controller.canGoNext ? controller.next : null,
    );
  }
}

class _ViewerBody extends StatelessWidget {
  const _ViewerBody({
    required this.controller,
    required this.onEditDay,
    required this.today,
  });

  final CalendarDaysController controller;
  final ValueChanged<CalendarDay> onEditDay;
  final DateTime? today;

  @override
  Widget build(BuildContext context) {
    final period = controller.period;
    if (controller.state == CalendarDaysState.error) {
      return AppErrorView(
        message: controller.error ?? 'Não foi possível carregar os dias.',
        onRetry: controller.load,
      );
    }
    if (period == null) return const AppLoadingView();
    return Stack(
      children: <Widget>[
        _PeriodBody(controller: controller, onEditDay: onEditDay, today: today),
        if (controller.state == CalendarDaysState.loading)
          const Positioned(
            left: 0,
            right: 0,
            top: 0,
            child: LinearProgressIndicator(minHeight: 2),
          ),
      ],
    );
  }
}

class _PeriodBody extends StatelessWidget {
  const _PeriodBody({
    required this.controller,
    required this.onEditDay,
    required this.today,
  });

  final CalendarDaysController controller;
  final ValueChanged<CalendarDay> onEditDay;
  final DateTime? today;

  @override
  Widget build(BuildContext context) {
    final period = controller.period!;
    return switch (period.view) {
      CalendarView.day => CalendarDayDetail(
        day: controller.dayOn(period.startDate),
        onEdit: onEditDay,
      ),
      CalendarView.week => CalendarWeekStrip(
        start: period.startDate,
        dayOn: controller.dayOn,
        onTapDay: onEditDay,
        today: today,
      ),
      CalendarView.month => CalendarMonthGrid(
        month: period.startDate,
        dayOn: controller.dayOn,
        onTapDay: onEditDay,
        today: today,
      ),
      CalendarView.year => CalendarYearGrid(
        year: period.startDate.year,
        dayOn: controller.dayOn,
        onOpenMonth: (m) => controller.goTo(m, view: CalendarView.month),
        onTapDay: onEditDay,
        today: today,
      ),
    };
  }
}
