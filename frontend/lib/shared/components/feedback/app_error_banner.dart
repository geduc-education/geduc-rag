import 'package:flutter/material.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/colors_app.dart';

/// Faixa de erro inline reutilizável (formulários, telas de estado).
///
/// Renderiza `null`/vazio como um espaço zero para não deslocar o layout.
/// Opcionalmente exibe uma ação inline de recuperação ([onRetry], com rótulo
/// [retryLabel]) — ex.: "Recarregar" no banner de refs da fila de chamados.
class AppErrorBanner extends StatelessWidget {
  const AppErrorBanner({
    super.key,
    required this.message,
    this.retryLabel,
    this.onRetry,
  });

  final String? message;

  /// Rótulo da ação de recuperação; `null` usa 'Tentar novamente'.
  final String? retryLabel;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final text = message;
    if (text == null || text.isEmpty) return const SizedBox.shrink();
    final colors = context.colors;
    return Container(
      width: double.infinity,
      padding: AppDimensions.paddingMd,
      decoration: BoxDecoration(
        color: colors.danger50,
        borderRadius: AppDimensions.borderRadius,
        border: Border.all(color: colors.danger100),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(Icons.error_outline, color: colors.danger500, size: 20),
          AppDimensions.hGapSm,
          Expanded(
            child: Text(
              text,
              style: context.textStyles.textSmall.copyWith(
                color: colors.danger700,
              ),
            ),
          ),
          if (onRetry != null) ...<Widget>[
            AppDimensions.hGapSm,
            TextButton(
              onPressed: onRetry,
              style: TextButton.styleFrom(
                foregroundColor: colors.danger700,
                minimumSize: Size.zero,
                padding: const EdgeInsets.symmetric(
                  horizontal: AppDimensions.gapSm,
                  vertical: AppDimensions.gapXs,
                ),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: Text(
                retryLabel ?? 'Tentar novamente',
                style: context.textStyles.textSmallBold.copyWith(
                  color: colors.danger700,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
