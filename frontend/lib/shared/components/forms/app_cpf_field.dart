import 'package:flutter/material.dart';

import '../../utils/cpf.dart';
import 'app_text_field.dart';

/// Campo de CPF do design system: compõe o [AppTextField] com a máscara
/// `000.000.000-00` e a validação de 11 dígitos. O valor do [controller] vem
/// formatado; use [Cpf.digits] para enviar ao backend.
class AppCpfField extends StatelessWidget {
  const AppCpfField({
    super.key,
    required this.controller,
    this.label = 'CPF',
    this.enabled = true,
  });

  final TextEditingController controller;
  final String label;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return AppTextField(
      label: label,
      hint: '000.000.000-00',
      controller: controller,
      enabled: enabled,
      keyboardType: TextInputType.number,
      inputFormatters: const [CpfInputFormatter()],
      validator: Cpf.validate,
    );
  }
}
