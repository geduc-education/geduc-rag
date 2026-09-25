import 'package:flutter/material.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/colors_app.dart';

/// Estilo padrão dos toggles segmentados do design system (tickets e chat).
///
/// Segmento selecionado preenchido com [ColorsApp.primary]; os demais em
/// [ColorsApp.surfaceCard] com texto secundário. `shape` desenha só a borda
/// externa e `side` também tinge os divisores entre os segmentos (ver
/// [SegmentedButton]), por isso o par vem daqui. Diferenças de layout
/// (largura, rótulos compactos) ficam nos consumidores.
ButtonStyle appSegmentedButtonStyle(BuildContext context) {
  final colors = context.colors;
  return ButtonStyle(
    backgroundColor: WidgetStateProperty.resolveWith(
      (states) => states.contains(WidgetState.selected)
          ? colors.primary
          : colors.surfaceCard,
    ),
    foregroundColor: WidgetStateProperty.resolveWith(
      (states) => states.contains(WidgetState.selected)
          ? colors.white
          : colors.textSecondary,
    ),
    overlayColor: WidgetStatePropertyAll<Color>(
      colors.primary.withValues(alpha: 0.08),
    ),
    side: WidgetStatePropertyAll<BorderSide>(
      BorderSide(color: colors.borderDefault),
    ),
    shape: WidgetStatePropertyAll<OutlinedBorder>(
      RoundedRectangleBorder(borderRadius: AppDimensions.borderRadiusSm),
    ),
  );
}
