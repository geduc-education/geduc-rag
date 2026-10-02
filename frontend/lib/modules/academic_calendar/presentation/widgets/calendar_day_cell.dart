import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/colors_app.dart';
import '../../data/models/calendar_day.dart';
import 'calendar_day_type_style.dart';

/// Altura da célula do dia na grade do mês e na semana.
const double kCalendarCellHeight = 96;

/// Altura da célula compacta (mini-mês da visão ano).
const double kCalendarCompactCellHeight = 28;

/// Célula de um dia: fundo na cor suave do tipo, número do dia e, fora do
/// modo [compact], o tipo e a descrição. Toque abre a edição do dia.
///
/// [date] `null` = preenchimento fora do mês; [day] `null` = data fora do
/// período do calendário (sem tipo, não editável).
class CalendarDayCell extends StatelessWidget {
  const CalendarDayCell({
    super.key,
    required this.date,
    required this.day,
    this.isToday = false,
    this.compact = false,
    this.onTap,
  });

  final DateTime? date;
  final CalendarDay? day;
  final bool isToday;
  final bool compact;
  final ValueChanged<CalendarDay>? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final current = date;
    final info = day;
    final height = compact ? kCalendarCompactCellHeight : kCalendarCellHeight;
    final background = current == null
        ? colors.surfaceMuted
        : (info?.type.tint(context) ?? colors.surfaceCard);
    final box = Container(
      height: height,
      padding: compact ? AppDimensions.paddingZero : AppDimensions.paddingSm,
      alignment: compact ? Alignment.center : Alignment.topLeft,
      decoration: BoxDecoration(
        color: background,
        border: Border.all(color: colors.borderSubtle, width: 0.5),
      ),
      child: current == null
          ? null
          : _CellContent(
              date: current,
              day: info,
              isToday: isToday,
              compact: compact,
            ),
    );
    final tap = onTap;
    if (info == null || current == null) return box;
    final description = info.description;
    return Tooltip(
      message: description == null
          ? info.type.label
          : '${info.type.label} — $description',
      child: InkWell(onTap: tap == null ? null : () => tap(info), child: box),
    );
  }
}

class _CellContent extends StatelessWidget {
  const _CellContent({
    required this.date,
    required this.day,
    required this.isToday,
    required this.compact,
  });

  final DateTime date;
  final CalendarDay? day;
  final bool isToday;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final number = _DayNumber(
      day: date.day,
      isToday: isToday,
      muted: day == null,
    );
    final info = day;
    if (compact || info == null) return number;
    final description = info.description;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        number,
        AppDimensions.vGapXs,
        _TypeBadge(day: info),
        if (description != null) ...<Widget>[
          AppDimensions.vGapXs,
          Text(
            description,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: context.textStyles.textVerySmallBold.copyWith(
              color: context.colors.textSecondary,
            ),
          ),
        ],
      ],
    );
  }
}

class _DayNumber extends StatelessWidget {
  const _DayNumber({
    required this.day,
    required this.isToday,
    required this.muted,
  });

  final int day;
  final bool isToday;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final style = context.textStyles.textSmallBold;
    if (!isToday) {
      final color = muted ? colors.textMuted : colors.textPrimary;
      return Text('$day', style: style.copyWith(color: color));
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppDimensions.gapXs),
      decoration: BoxDecoration(
        color: colors.primary,
        borderRadius: AppDimensions.borderRadiusPill,
      ),
      child: Text('$day', style: style.copyWith(color: colors.white)),
    );
  }
}

class _TypeBadge extends StatelessWidget {
  const _TypeBadge({required this.day});

  final CalendarDay day;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: AppDimensions.gapXs),
      decoration: BoxDecoration(
        color: day.type.accent(context),
        borderRadius: AppDimensions.borderRadiusSm,
      ),
      child: Text(
        day.type.label.toUpperCase(),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: context.textStyles.textVerySmallBold.copyWith(
          color: context.colors.white,
        ),
      ),
    );
  }
}
