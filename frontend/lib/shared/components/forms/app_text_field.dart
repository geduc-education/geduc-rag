import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/colors_app.dart';

/// Espessura da borda do campo em foco.
const double _focusedBorderWidth = 1.6;

/// Campo de texto padrão do design system.
///
/// Encapsula rótulo, placeholder, validação e o toggle de senha. Preferir
/// sempre este widget a `TextFormField` direto. Campos com anatomia própria
/// (ex.: `AppColorField`) compõem este widget pelo slot [suffix] em vez de
/// replicar a `InputDecoration`.
class AppTextField extends StatefulWidget {
  const AppTextField({
    super.key,
    required this.label,
    this.controller,
    this.focusNode,
    this.hint,
    this.obscure = false,
    this.enabled = true,
    this.autofocus = false,
    this.keyboardType,
    this.inputFormatters,
    this.validator,
    this.errorText,
    this.showErrorText = true,
    this.onSubmitted,
    this.onChanged,
    this.prefixIcon,
    this.suffix,
    this.maxLines = 1,
  }) : assert(
         !obscure || suffix == null,
         'O toggle de senha já ocupa o sufixo do campo.',
       );

  final String label;
  final TextEditingController? controller;

  /// Nó de foco externo (ex.: focar a senha após pré-preencher o e-mail).
  final FocusNode? focusNode;
  final String? hint;
  final bool obscure;
  final bool enabled;
  final bool autofocus;
  final TextInputType? keyboardType;
  final String? Function(String?)? validator;

  /// Erro exibido direto na decoração, sem passar pelo `Form` — para campos
  /// fora de formulário (ex.: o hex do seletor de cor) que validam a cada
  /// digitação. Quando nulo, vale só o [validator].
  final String? errorText;

  /// `false` esconde o **texto** do erro sem mexer na validação: o campo
  /// continua inválido para o `Form` e com a borda vermelha, mas a mensagem
  /// não é renderizada (nem ocupa altura). Para campos estreitos demais para
  /// a frase, que reportam o erro fora do campo — ver [AppTimeField].
  final bool showErrorText;

  final ValueChanged<String>? onSubmitted;
  final ValueChanged<String>? onChanged;
  final IconData? prefixIcon;

  /// Widget livre no fim do campo (amostra de cor, ação inline...). Mapeado
  /// para `InputDecoration.suffixIcon`; incompatível com [obscure], que já usa
  /// o slot para o toggle de senha.
  final Widget? suffix;

  /// Linhas do campo (>1 = multiline). Ignorado quando [obscure] é `true`.
  final int maxLines;

  /// Formatadores de entrada (máscara, allowlist de caracteres...). Slot para
  /// campos com máscara comporem este widget — ex.: `AppCnpjField` e
  /// `AppTimeField` — em vez de montarem um `TextFormField` próprio.
  final List<TextInputFormatter>? inputFormatters;

  @override
  State<AppTextField> createState() => _AppTextFieldState();
}

class _AppTextFieldState extends State<AppTextField> {
  late bool _obscured = widget.obscure;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final styles = context.textStyles;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(widget.label, style: styles.textSmallBold),
        AppDimensions.vGapXs,
        TextFormField(
          controller: widget.controller,
          focusNode: widget.focusNode,
          obscureText: _obscured,
          enabled: widget.enabled,
          autofocus: widget.autofocus,
          keyboardType: widget.keyboardType,
          inputFormatters: widget.inputFormatters,
          maxLines: widget.obscure ? 1 : widget.maxLines,
          validator: widget.validator,
          onChanged: widget.onChanged,
          onFieldSubmitted: widget.onSubmitted,
          style: styles.textRegular.copyWith(color: colors.textPrimary),
          decoration: _decoration(colors, styles),
        ),
      ],
    );
  }

  InputDecoration _decoration(ColorsApp colors, AppTextStyles styles) =>
      InputDecoration(
        hintText: widget.hint,
        hintStyle: styles.textRegular.copyWith(color: colors.textMuted),
        isDense: true,
        filled: true,
        fillColor: widget.enabled ? colors.surfaceCard : colors.surfaceMuted,
        errorText: widget.errorText,
        prefixIcon: widget.prefixIcon == null
            ? null
            : Icon(
                widget.prefixIcon,
                color: colors.textMuted,
                size: AppDimensions.iconSizeMd,
              ),
        suffixIcon: widget.obscure
            ? _ObscureToggle(
                obscured: _obscured,
                onToggle: () => setState(() => _obscured = !_obscured),
              )
            : widget.suffix,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppDimensions.gapMd,
          vertical: AppDimensions.gapMd,
        ),
        enabledBorder: _border(colors.borderDefault),
        focusedBorder: _border(colors.primary, width: _focusedBorderWidth),
        disabledBorder: _border(colors.borderSubtle),
        errorBorder: _border(colors.danger500),
        focusedErrorBorder: _border(
          colors.danger500,
          width: _focusedBorderWidth,
        ),
        // `fontSize: 0` colapsa o texto do erro (fica só a borda vermelha) e o
        // `helperText` vazio ocupa a mesma faixa no estado válido — sem isso o
        // campo daria um pulo de altura ao ficar inválido.
        errorStyle: widget.showErrorText ? _errorStyle(colors, styles) : _mute,
        helperText: widget.showErrorText ? null : '',
        helperStyle: widget.showErrorText ? null : _mute,
      );

  /// Estilo que zera a altura da faixa de mensagem sob o campo.
  static const TextStyle _mute = TextStyle(fontSize: 0, height: 0);

  TextStyle _errorStyle(ColorsApp colors, AppTextStyles styles) =>
      styles.textSmall.copyWith(color: colors.danger500);

  OutlineInputBorder _border(Color color, {double width = 1}) =>
      OutlineInputBorder(
        borderRadius: AppDimensions.borderRadius,
        borderSide: BorderSide(color: color, width: width),
      );
}

/// Olho de mostrar/ocultar senha — sufixo fixo dos campos `obscure`.
class _ObscureToggle extends StatelessWidget {
  const _ObscureToggle({required this.obscured, required this.onToggle});

  final bool obscured;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: obscured ? 'Mostrar' : 'Ocultar',
      icon: Icon(
        obscured ? Icons.visibility_off_outlined : Icons.visibility_outlined,
        color: context.colors.textMuted,
        size: AppDimensions.iconSizeMd,
      ),
      onPressed: onToggle,
    );
  }
}
