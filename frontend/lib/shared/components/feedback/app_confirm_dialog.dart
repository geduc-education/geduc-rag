import 'package:flutter/material.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/colors_app.dart';
import '../buttons/app_primary_button.dart';
import '../buttons/app_secondary_button.dart';

/// Diálogo de confirmação para ações críticas (excluir, remover perfil,
/// inativar). Retorna `true` quando confirmado, `false`/`null` caso contrário.
class AppConfirmDialog extends StatelessWidget {
  const AppConfirmDialog({
    super.key,
    required this.title,
    required this.message,
    this.confirmLabel = 'Confirmar',
    this.cancelLabel = 'Cancelar',
    this.danger = false,
  });

  final String title;
  final String message;
  final String confirmLabel;
  final String cancelLabel;

  /// Ação IRREVERSÍVEL: pinta o botão de confirmação de vermelho. Era um
  /// parâmetro morto — declarado, repassado pelo `show` e nunca lido no
  /// `build` —, então a purga definitiva saía visualmente idêntica ao
  /// restaurar, que é reversível.
  final bool danger;

  static Future<bool> show(
    BuildContext context, {
    required String title,
    required String message,
    String confirmLabel = 'Confirmar',
    String cancelLabel = 'Cancelar',
    bool danger = false,
  }) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (_) => AppConfirmDialog(
        title: title,
        message: message,
        confirmLabel: confirmLabel,
        cancelLabel: cancelLabel,
        danger: danger,
      ),
    );
    return result ?? false;
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: context.colors.surfaceOverlay,
      shape: RoundedRectangleBorder(
        borderRadius: AppDimensions.dialogsBorderRadius,
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Padding(
          padding: AppDimensions.paddingXl,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(title, style: context.textStyles.textTile),
              AppDimensions.vGapSm,
              Text(message, style: context.textStyles.textRegular),
              AppDimensions.vGapXl,
              // Wrap (e não Row): rótulos longos quebram de linha em vez de
              // estourar a largura fixa do diálogo. O SizedBox garante a
              // largura total para o alinhamento à direita.
              SizedBox(
                width: double.infinity,
                child: Wrap(
                  alignment: WrapAlignment.end,
                  spacing: AppDimensions.gapSm,
                  runSpacing: AppDimensions.gapSm,
                  children: <Widget>[
                    AppSecondaryButton(
                      label: cancelLabel,
                      onPressed: () => Navigator.of(context).pop(false),
                    ),
                    AppPrimaryButton(
                      label: confirmLabel,
                      danger: danger,
                      onPressed: () => Navigator.of(context).pop(true),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
