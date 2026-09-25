import 'package:flutter/material.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/colors_app.dart';

/// Botão de ação secundário (contornado) do design system.
///
/// Usado para ações de menor destaque (cancelar, voltar). Fica desabilitado
/// quando [onPressed] é `null`.
class AppSecondaryButton extends StatelessWidget {
  const AppSecondaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.danger = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;

  /// Renderiza em tom de perigo (ações destrutivas).
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final accent = danger ? colors.danger500 : colors.neutral700;
    return OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        foregroundColor: accent,
        minimumSize: const Size(0, AppDimensions.inputHeight),
        padding: const EdgeInsets.symmetric(horizontal: AppDimensions.gapXl),
        side: BorderSide(
          color: danger ? colors.danger500 : colors.borderDefault,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: AppDimensions.buttonBorderRadius,
        ),
      ),
      child: _Content(label: label, icon: icon, color: accent),
    );
  }
}

class _Content extends StatelessWidget {
  const _Content({required this.label, required this.color, this.icon});

  final String label;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final text = Text(
      label,
      style: context.textStyles.textRegularBold.copyWith(color: color),
    );
    if (icon == null) return text;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Icon(icon, size: AppDimensions.iconSizeMd, color: color),
        AppDimensions.hGapSm,
        text,
      ],
    );
  }
}
