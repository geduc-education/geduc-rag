import 'package:flutter/material.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/colors_app.dart';

/// Botão de ação primário do design system.
///
/// Preenchido com [ColorsApp.primary]; exibe um spinner quando [loading] é
/// `true` (mantendo a largura) e fica desabilitado quando [onPressed] é `null`
/// ou durante o carregamento. Preferir sempre este widget a `ElevatedButton`.
class AppPrimaryButton extends StatelessWidget {
  const AppPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.loading = false,
    this.expand = false,
    this.danger = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool loading;

  /// Ocupa toda a largura disponível quando `true`.
  final bool expand;

  /// Ação DESTRUTIVA e sem volta: pinta o botão de vermelho. Reservado para o
  /// que não se desfaz — gastar o vermelho no reversível esvazia o sinal
  /// exatamente onde ele importa.
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final enabled = onPressed != null && !loading;
    final button = FilledButton(
      onPressed: enabled ? onPressed : null,
      style: FilledButton.styleFrom(
        backgroundColor: danger ? colors.danger500 : colors.primary,
        disabledBackgroundColor: colors.neutral300,
        foregroundColor: colors.white,
        disabledForegroundColor: colors.neutral500,
        minimumSize: const Size(0, AppDimensions.inputHeight),
        padding: const EdgeInsets.symmetric(horizontal: AppDimensions.gapXl),
        shape: RoundedRectangleBorder(
          borderRadius: AppDimensions.buttonBorderRadius,
        ),
      ),
      child: loading
          ? SizedBox(
              width: AppDimensions.iconSizeMd,
              height: AppDimensions.iconSizeMd,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: colors.white,
              ),
            )
          : _Content(label: label, icon: icon),
    );
    return expand ? SizedBox(width: double.infinity, child: button) : button;
  }
}

class _Content extends StatelessWidget {
  const _Content({required this.label, this.icon});

  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final text = Text(
      label,
      style: context.textStyles.textRegularBold.copyWith(
        color: context.colors.white,
      ),
    );
    if (icon == null) return text;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Icon(icon, size: AppDimensions.iconSizeMd, color: context.colors.white),
        AppDimensions.hGapSm,
        text,
      ],
    );
  }
}
