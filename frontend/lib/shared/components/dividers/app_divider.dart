import 'package:flutter/material.dart';

import '../../../core/theme/colors_app.dart';

/// Opções de peso visual para [AppDivider].
///
/// `hairline` — linha de 1px em [ColorsApp.borderSubtle] (listas, timeline).
/// `regular`  — linha de 1px em [ColorsApp.borderDefault] (cards, seções).
enum AppDividerVariant { hairline, regular }

/// Separador horizontal ou vertical que consome apenas tokens de borda.
class AppDivider extends StatelessWidget {
  const AppDivider({
    super.key,
    this.orientation = Axis.horizontal,
    this.variant = AppDividerVariant.hairline,
    this.length,
  });

  final Axis orientation;
  final AppDividerVariant variant;
  final double? length;

  @override
  Widget build(BuildContext context) {
    final color = variant == AppDividerVariant.hairline
        ? context.colors.borderSubtle
        : context.colors.borderDefault;
    const thickness = 1.0;
    if (orientation == Axis.horizontal) {
      return SizedBox(
        width: length,
        height: thickness,
        child: ColoredBox(color: color),
      );
    }
    return SizedBox(
      width: thickness,
      height: length,
      child: ColoredBox(color: color),
    );
  }
}
