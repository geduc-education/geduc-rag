import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/colors_app.dart';
import '../../../../shared/components/dividers/app_divider.dart';

/// Painel do Calendário Acadêmico: título em caixa alta numa faixa própria,
/// divisória e o conteúdo abaixo (filtros, calendário, registros do mês).
class CalendarPanel extends StatelessWidget {
  const CalendarPanel({
    super.key,
    required this.title,
    required this.child,
    this.padding = AppDimensions.paddingLg,
  });

  final String title;
  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      decoration: BoxDecoration(
        color: colors.surfaceCard,
        borderRadius: AppDimensions.borderRadius,
        border: Border.all(color: colors.borderSubtle),
        boxShadow: AppDimensions.shadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppDimensions.gapXl,
              vertical: AppDimensions.gapLg,
            ),
            child: Text(
              title.toUpperCase(),
              style: context.textStyles.textTile16.copyWith(
                color: colors.textPrimary,
              ),
            ),
          ),
          const AppDivider(),
          Padding(padding: padding, child: child),
        ],
      ),
    );
  }
}
