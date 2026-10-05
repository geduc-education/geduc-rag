import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../utils/time_text.dart';
import 'app_text_field.dart';

/// Campo de hora `HH:mm` (00:00 a 23:59), compondo o [AppTextField]: aceita
/// só dígitos e insere os dois-pontos sozinho. Largura fixa de hora.
class AppTimeField extends StatelessWidget {
  const AppTimeField({
    super.key,
    required this.label,
    required this.controller,
    this.enabled = true,
  });

  final String label;
  final TextEditingController controller;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: AppDimensions.timeFieldWidth,
      child: AppTextField(
        label: label,
        hint: 'HH:mm',
        controller: controller,
        enabled: enabled,
        keyboardType: TextInputType.datetime,
        inputFormatters: <TextInputFormatter>[
          FilteringTextInputFormatter.digitsOnly,
          LengthLimitingTextInputFormatter(4),
          const _TimeColonFormatter(),
        ],
        validator: (value) =>
            isValidTimeText(value ?? '') ? null : 'Hora inválida.',
      ),
    );
  }
}

/// `0830` → `08:30` enquanto digita.
class _TimeColonFormatter extends TextInputFormatter {
  const _TimeColonFormatter();

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = newValue.text;
    final text = digits.length <= 2
        ? digits
        : '${digits.substring(0, 2)}:${digits.substring(2)}';
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}
