import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/colors_app.dart';
import '../../../../shared/components/responsive/breakpoints.dart';
import '../../data/models/calendar_day_type.dart';
import '../../data/models/day_type_totals.dart';
import 'calendar_accent_card.dart';
import 'calendar_day_type_style.dart';

/// Faixa de cards com o quantitativo de dias por tipo (`totals` da API). Os
/// cards também servem de legenda das cores da grade. Em telas estreitas
/// quebram em grade de duas ou três colunas.
class CalendarSummaryRow extends StatelessWidget {
  const CalendarSummaryRow({super.key, required this.totals});

  final DayTypeTotals totals;

  @override
  Widget build(BuildContext context) {
    const types = CalendarDayType.values;
    return LayoutBuilder(
      builder: (context, constraints) {
        final breakpoint = AppBreakpoints.fromConstraints(constraints);
        final perRow = breakpoint.isDesktop
            ? types.length
            : (breakpoint.isTablet ? 3 : 2);
        const gap = AppDimensions.gapLg;
        final width = (constraints.maxWidth - gap * (perRow - 1)) / perRow;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: <Widget>[
            for (final type in types)
              SizedBox(
                width: width,
                child: _SummaryCard(type: type, count: totals.countOf(type)),
              ),
          ],
        );
      },
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.type, required this.count});

  final CalendarDayType type;
  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final styles = context.textStyles;
    return CalendarAccentCard(
      accent: type.accent(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            type.label.toUpperCase(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: styles.textSmallBold.copyWith(color: colors.textSecondary),
          ),
          AppDimensions.vGapSm,
          Text(
            '$count',
            style: styles.textTile20.copyWith(color: colors.textPrimary),
          ),
        ],
      ),
    );
  }
}
