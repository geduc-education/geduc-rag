import 'package:flutter/material.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/colors_app.dart';

/// Opção genérica de um [AppDropdownField].
class AppDropdownOption<T> {
  const AppDropdownOption({
    required this.value,
    required this.label,
    this.enabled = true,
  });
  final T value;
  final String label;

  /// `false` = visível porém não selecionável no menu (texto muted). O valor
  /// corrente pode apontar para uma opção desabilitada — segue exibido, só
  /// não pode ser re-escolhido (ex.: code legado/já usado no form de Status).
  final bool enabled;
}

/// Dropdown padrão do design system (rótulo + `DropdownButtonFormField`).
///
/// Encapsula o visual (borda, fill, tipografia) coerente com [AppTextField].
/// Suporta um item "nenhum"/placeholder via [hint] com `value == null` e um
/// estado [loading] (desabilitado + spinner no lugar do chevron), para combos
/// cuja fonte ainda está carregando.
class AppDropdownField<T> extends StatelessWidget {
  const AppDropdownField({
    super.key,
    required this.label,
    required this.options,
    required this.value,
    required this.onChanged,
    this.hint,
    this.enabled = true,
    this.loading = false,
    this.validator,
    this.helperText,
  });

  final String label;
  final List<AppDropdownOption<T>> options;
  final T? value;
  final ValueChanged<T?>? onChanged;
  final String? hint;
  final bool enabled;
  final bool loading;
  final String? Function(T?)? validator;

  /// Dica sob o campo (mesmo slot do erro), para orientar a escolha sem
  /// decidir por quem preenche. `null` = sem faixa de texto.
  final String? helperText;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final styles = context.textStyles;
    final interactive = enabled && !loading;
    // Garante que o value corrente exista nas options (evita assert do framework).
    final hasValue = value != null && options.any((o) => o.value == value);
    return Column(
      // Dimensiona ao conteúdo: sem isso, dentro de AlertDialog o campo
      // estica o diálogo à altura máxima disponível (R-06).
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(label, style: styles.textSmallBold),
        AppDimensions.vGapXs,
        DropdownButtonFormField<T>(
          initialValue: hasValue ? value : null,
          isExpanded: true,
          validator: validator,
          onChanged: interactive ? onChanged : null,
          hint: hint == null
              ? null
              : Text(
                  hint!,
                  style: styles.textRegular.copyWith(color: colors.textMuted),
                ),
          style: styles.textRegular.copyWith(color: colors.textPrimary),
          icon: loading
              ? SizedBox(
                  width: AppDimensions.gapLg,
                  height: AppDimensions.gapLg,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: colors.textMuted,
                  ),
                )
              : Icon(Icons.expand_more, color: colors.textMuted),
          dropdownColor: colors.surfaceCard,
          decoration: InputDecoration(
            isDense: true,
            filled: true,
            fillColor: interactive ? colors.surfaceCard : colors.surfaceMuted,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: AppDimensions.gapMd,
              vertical: AppDimensions.gapMd,
            ),
            enabledBorder: _border(colors.borderDefault),
            focusedBorder: _border(colors.primary, width: 1.6),
            disabledBorder: _border(colors.borderSubtle),
            errorBorder: _border(colors.danger500),
            focusedErrorBorder: _border(colors.danger500, width: 1.6),
            errorStyle: styles.textSmall.copyWith(color: colors.danger500),
            helperText: helperText,
            helperMaxLines: 2,
            helperStyle: styles.textSmall.copyWith(color: colors.textMuted),
          ),
          items: <DropdownMenuItem<T>>[
            for (final option in options)
              DropdownMenuItem<T>(
                value: option.value,
                enabled: option.enabled,
                child: Text(
                  option.label,
                  overflow: TextOverflow.ellipsis,
                  style: option.enabled
                      ? null
                      : styles.textRegular.copyWith(color: colors.textMuted),
                ),
              ),
          ],
        ),
      ],
    );
  }

  OutlineInputBorder _border(Color color, {double width = 1}) =>
      OutlineInputBorder(
        borderRadius: AppDimensions.borderRadius,
        borderSide: BorderSide(color: color, width: width),
      );
}
