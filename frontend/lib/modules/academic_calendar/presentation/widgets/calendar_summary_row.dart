import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/colors_app.dart';
import '../../../../shared/components/responsive/breakpoints.dart';
import '../../data/models/calendar_event.dart';
import 'calendar_accent_card.dart';
import 'calendar_event_type_style.dart';

/// Faixa de cards com a contagem do mês por tipo de registro. Em telas
/// estreitas os cards quebram em grade de duas colunas.
class CalendarSummaryRow extends StatelessWidget {
  const CalendarSummaryRow({super.key, required this.countOf});

  /// Contagem do mês para cada tipo.
  final int Function(CalendarEventType type) countOf;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final breakpoint = AppBreakpoints.fromConstraints(constraints);
        final perRow = breakpoint.isDesktop
            ? calendarSummaryTypes.length
            : (breakpoint.isTablet ? 3 : 2);
        const gap = AppDimensions.gapLg;
        final width = (constraints.maxWidth - gap * (perRow - 1)) / perRow;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: <Widget>[
            for (final type in calendarSummaryTypes)
              SizedBox(
                width: width,
                child: _SummaryCard(type: type, count: countOf(type)),
              ),
          ],
        );
      },
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.type, required this.count});

  final CalendarEventType type;
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
            style: styles.textTile20.copyWith(
              fontSize: 28,
              color: colors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
