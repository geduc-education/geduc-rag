import 'package:flutter/material.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/colors_app.dart';

/// Campo somente leitura no formato dos demais campos do formulário: rótulo em
/// cima e uma caixa esmaecida com ícone opcional e o valor.
///
/// Usado onde o dado existe mas é imutável no painel — o licenciado dono do
/// cliente e do sistema, por exemplo. Não é um `AppTextField` desabilitado de
/// propósito: não há entrada, foco nem validação a oferecer.
class AppReadOnlyField extends StatelessWidget {
  const AppReadOnlyField({
    super.key,
    required this.label,
    required this.value,
    this.icon,
    this.placeholder = '—',
  });

  final String label;

  /// Valor exibido; `null`/vazio cai no [placeholder].
  final String? value;

  final IconData? icon;
  final String placeholder;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = (value == null || value!.trim().isEmpty)
        ? placeholder
        : value!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(label, style: context.textStyles.textSmallBold),
        AppDimensions.vGapXs,
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(
            horizontal: AppDimensions.gapMd,
            vertical: AppDimensions.gapMd,
          ),
          decoration: BoxDecoration(
            color: colors.surfaceMuted,
            borderRadius: AppDimensions.borderRadius,
            border: Border.all(color: colors.borderSubtle),
          ),
          child: Row(
            children: <Widget>[
              if (icon != null) ...<Widget>[
                Icon(
                  icon,
                  size: AppDimensions.iconSizeMd,
                  color: colors.textMuted,
                ),
                AppDimensions.hGapSm,
              ],
              Expanded(
                child: Text(
                  text,
                  style: context.textStyles.textRegular.copyWith(
                    color: colors.textSecondary,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
