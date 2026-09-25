import 'package:flutter/material.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/colors_app.dart';

/// Switch rotulado para uso DENTRO de card de formulário.
///
/// Construído com `Row` + `Switch`, e NÃO com `SwitchListTile`: o `ListTile`
/// exige um `Material` ancestral imediato e dispara assert do framework nos
/// cards que pintam o próprio fundo num `DecoratedBox`. É por isso que este
/// widget coexiste com o `SwitchListTile` usado nas telas sem card
/// (`ChatFlagSwitch`, horários, calendário) — não é duplicação: são contextos
/// de layout diferentes, cada um com UMA implementação.
///
/// A [description] opcional é o texto de apoio sob o rótulo — flag com
/// consequência operacional (ex.: desligar a varredura de uma caixa) merece a
/// explicação ao lado da chave, não só o nome.
class AppSwitchRow extends StatelessWidget {
  const AppSwitchRow({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    this.enabled = true,
    this.description,
  });

  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;
  final bool enabled;

  /// Texto secundário sob o rótulo; nulo = só o rótulo.
  final String? description;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final description = this.description;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(label, style: context.textStyles.textSmallBold),
              if (description != null) ...<Widget>[
                AppDimensions.vGapXs,
                Text(
                  description,
                  style: context.textStyles.textSmall.copyWith(
                    color: colors.textMuted,
                  ),
                ),
              ],
            ],
          ),
        ),
        AppDimensions.hGapMd,
        Switch(
          value: value,
          onChanged: enabled ? onChanged : null,
          activeThumbColor: colors.primary,
        ),
      ],
    );
  }
}
