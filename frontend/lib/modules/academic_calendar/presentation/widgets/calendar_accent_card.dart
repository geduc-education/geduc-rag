import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/colors_app.dart';

/// Card com faixa colorida à esquerda (cor do tipo de registro), usado nos
/// cards de resumo e nos registros do mês.
///
/// A faixa é um filho recortado pelo raio — `Border` só à esquerda com
/// `borderRadius` não é suportado pelo `BoxDecoration`.
class CalendarAccentCard extends StatelessWidget {
  const CalendarAccentCard({
    super.key,
    required this.accent,
    required this.child,
    this.padding = AppDimensions.paddingLg,
  });

  final Color accent;
  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surfaceCard,
        borderRadius: AppDimensions.borderRadius,
        border: Border.all(color: colors.borderSubtle),
        boxShadow: AppDimensions.shadowSm,
      ),
      child: ClipRRect(
        borderRadius: AppDimensions.borderRadius,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              SizedBox(
                width: AppDimensions.sidebarAccentWidth,
                child: ColoredBox(color: accent),
              ),
              Expanded(
                child: Padding(padding: padding, child: child),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
