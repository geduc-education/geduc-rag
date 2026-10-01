import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/colors_app.dart';
import '../../../../shared/components/buttons/app_primary_button.dart';
import '../../../../shared/components/buttons/app_secondary_button.dart';
import '../../../../shared/components/feedback/app_inline_notice.dart';
import '../../../../shared/components/forms/app_text_field.dart';

/// Confirmação FORTE da exclusão definitiva: o botão só habilita depois que
/// o ator digita a palavra [confirmationWord]. Devolve `true` se confirmado.
class PurgeEmployeeDialog extends StatefulWidget {
  const PurgeEmployeeDialog({super.key, required this.employeeName});

  final String employeeName;

  /// Palavra que precisa ser digitada para liberar a exclusão.
  static const String confirmationWord = 'EXCLUIR';

  static Future<bool> show(BuildContext context, String employeeName) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (_) => PurgeEmployeeDialog(employeeName: employeeName),
    );
    return result ?? false;
  }

  @override
  State<PurgeEmployeeDialog> createState() => _PurgeEmployeeDialogState();
}

class _PurgeEmployeeDialogState extends State<PurgeEmployeeDialog> {
  final _confirmation = TextEditingController();

  bool get _matches =>
      _confirmation.text.trim() == PurgeEmployeeDialog.confirmationWord;

  @override
  void dispose() {
    _confirmation.dispose();
    super.dispose();
  }

  void _confirm() {
    if (_matches) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: context.colors.surfaceOverlay,
      shape: RoundedRectangleBorder(
        borderRadius: AppDimensions.dialogsBorderRadius,
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 460),
        child: Padding(
          padding: AppDimensions.paddingXl,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(
                'Excluir definitivamente',
                style: context.textStyles.textTile,
              ),
              AppDimensions.vGapSm,
              Text(
                'O funcionário "${widget.employeeName}" será apagado do '
                'banco de dados de forma permanente.',
                style: context.textStyles.textRegular,
              ),
              AppDimensions.vGapMd,
              const AppInlineNotice(
                message:
                    'Esta ação é IRREVERSÍVEL: não há como restaurar o '
                    'registro depois.',
                icon: Icons.warning_amber_rounded,
                tone: AppNoticeTone.warning,
              ),
              AppDimensions.vGapLg,
              AppTextField(
                label:
                    'Digite ${PurgeEmployeeDialog.confirmationWord} para '
                    'confirmar',
                controller: _confirmation,
                autofocus: true,
                onChanged: (_) => setState(() {}),
                onSubmitted: (_) => _confirm(),
              ),
              AppDimensions.vGapXl,
              Wrap(
                alignment: WrapAlignment.end,
                spacing: AppDimensions.gapSm,
                runSpacing: AppDimensions.gapSm,
                children: <Widget>[
                  AppSecondaryButton(
                    label: 'Cancelar',
                    onPressed: () => Navigator.of(context).pop(false),
                  ),
                  AppPrimaryButton(
                    label: 'Excluir definitivamente',
                    danger: true,
                    onPressed: _matches ? _confirm : null,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
