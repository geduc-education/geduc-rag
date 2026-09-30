import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/colors_app.dart';
import '../../data/models/calendar_event.dart';
import 'calendar_event_type_style.dart';

/// Altura de cada célula de dia da grade.
const double _kCellHeight = 104;

/// Selos exibidos por célula antes do "+N".
const int _kMaxBadges = 2;

/// Grade mensal (domingo a sábado) com navegação entre meses e os registros
/// de cada dia como selos coloridos pelo tipo.
class CalendarMonthGrid extends StatelessWidget {
  const CalendarMonthGrid({
    super.key,
    required this.month,
    required this.eventsOn,
    required this.onPrevious,
    required this.onNext,
    this.today,
  });

  /// Primeiro dia do mês exibido.
  final DateTime month;
  final List<CalendarEvent> Function(int day) eventsOn;
  final VoidCallback onPrevious;
  final VoidCallback onNext;

  /// Dia destacado como "hoje"; `null` usa a data do dispositivo.
  final DateTime? today;

  @override
  Widget build(BuildContext context) {
    final leading = DateTime(month.year, month.month).weekday % 7;
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    final weeks = ((leading + daysInMonth) / 7).ceil();
    final now = today ?? DateTime.now();
    final todayDay = now.year == month.year && now.month == month.month
        ? now.day
        : null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        _MonthHeader(month: month, onPrevious: onPrevious, onNext: onNext),
        AppDimensions.vGapLg,
        const _WeekdayRow(),
        AppDimensions.vGapSm,
        for (var week = 0; week < weeks; week++)
          Row(
            children: <Widget>[
              for (var col = 0; col < 7; col++)
                Expanded(
                  child: _DayCell(
                    day: _dayAt(week * 7 + col - leading + 1, daysInMonth),
                    isToday: week * 7 + col - leading + 1 == todayDay,
                    eventsOn: eventsOn,
                  ),
                ),
            ],
          ),
      ],
    );
  }

  static int? _dayAt(int day, int daysInMonth) =>
      day >= 1 && day <= daysInMonth ? day : null;
}

class _MonthHeader extends StatelessWidget {
  const _MonthHeader({
    required this.month,
    required this.onPrevious,
    required this.onNext,
  });

  final DateTime month;
  final VoidCallback onPrevious;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final label = '${calendarMonthName(month)} de ${month.year}';
    return Row(
      children: <Widget>[
        IconButton.outlined(
          tooltip: 'Mês anterior',
          icon: const Icon(Icons.chevron_left),
          onPressed: onPrevious,
        ),
        Expanded(
          child: Text(
            label.toUpperCase(),
            textAlign: TextAlign.center,
            style: context.textStyles.textTile.copyWith(
              color: context.colors.textPrimary,
            ),
          ),
        ),
        IconButton.outlined(
          tooltip: 'Próximo mês',
          icon: const Icon(Icons.chevron_right),
          onPressed: onNext,
        ),
      ],
    );
  }
}

class _WeekdayRow extends StatelessWidget {
  const _WeekdayRow();

  @override
  Widget build(BuildContext context) {
    final style = context.textStyles.textSmallBold.copyWith(
      color: context.colors.info500,
    );
    return Row(
      children: <Widget>[
        for (final label in calendarWeekdayLabels)
          Expanded(
            child: Text(
              label.toUpperCase(),
              textAlign: TextAlign.center,
              style: style,
            ),
          ),
      ],
    );
  }
}

class _DayCell extends StatelessWidget {
  const _DayCell({
    required this.day,
    required this.isToday,
    required this.eventsOn,
  });

  /// Dia do mês; `null` = célula de preenchimento fora do mês.
  final int? day;
  final bool isToday;
  final List<CalendarEvent> Function(int day) eventsOn;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final current = day;
    final events = current == null
        ? const <CalendarEvent>[]
        : eventsOn(current);
    return Container(
      height: _kCellHeight,
      padding: AppDimensions.paddingSm,
      decoration: BoxDecoration(
        color: current == null ? colors.surfaceMuted : colors.surfaceCard,
        border: Border.all(color: colors.borderSubtle, width: 0.5),
      ),
      child: current == null
          ? null
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                _DayNumber(day: current, isToday: isToday),
                AppDimensions.vGapXs,
                for (final event in events.take(_kMaxBadges))
                  _EventBadge(event: event),
                if (events.length > _kMaxBadges)
                  Text(
                    '+${events.length - _kMaxBadges}',
                    style: context.textStyles.textSmallBold,
                  ),
              ],
            ),
    );
  }
}

class _DayNumber extends StatelessWidget {
  const _DayNumber({required this.day, required this.isToday});

  final int day;
  final bool isToday;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final style = context.textStyles.textSmallBold;
    if (!isToday) {
      return Text('$day', style: style.copyWith(color: colors.textPrimary));
    }
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppDimensions.gapSm,
        vertical: 2,
      ),
      decoration: BoxDecoration(
        color: colors.primary,
        borderRadius: AppDimensions.borderRadiusPill,
      ),
      child: Text('$day', style: style.copyWith(color: colors.white)),
    );
  }
}

class _EventBadge extends StatelessWidget {
  const _EventBadge({required this.event});

  final CalendarEvent event;

  @override
  Widget build(BuildContext context) {
    final scope = event.isNetworkWide ? calendarNetworkScopeLabel : 'Escola';
    final label = '$scope • ${event.title}'.toUpperCase();
    return Tooltip(
      message: '${event.title} — ${event.type.label} • ${event.scopeName}',
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 2),
        padding: const EdgeInsets.symmetric(
          horizontal: AppDimensions.gapXs,
          vertical: 2,
        ),
        decoration: BoxDecoration(
          color: event.type.accent(context),
          borderRadius: AppDimensions.borderRadiusSm,
        ),
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: context.textStyles.textVerySmallBold.copyWith(
            color: context.colors.white,
          ),
        ),
      ),
    );
  }
}
