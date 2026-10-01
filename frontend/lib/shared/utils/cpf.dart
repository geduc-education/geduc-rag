import 'package:flutter/services.dart';

/// Utilitários de CPF: o backend grava só os 11 dígitos; a UI exibe e digita
/// com a máscara `000.000.000-00`.
abstract final class Cpf {
  static const int length = 11;

  static final RegExp _nonDigits = RegExp(r'\D');

  /// Remove tudo que não é dígito (`123.456.789-09` → `12345678909`).
  static String digits(String? value) =>
      (value ?? '').replaceAll(_nonDigits, '');

  /// Formata os dígitos de [value] como `000.000.000-00`. Entrada parcial
  /// recebe a máscara até onde houver dígito; acima de 11 dígitos, devolve o
  /// valor sem formatação (dado fora do contrato, exibido como veio).
  static String format(String? value) {
    final d = digits(value);
    if (d.length > length) return value ?? '';
    final buffer = StringBuffer();
    for (var i = 0; i < d.length; i++) {
      if (i == 3 || i == 6) buffer.write('.');
      if (i == 9) buffer.write('-');
      buffer.write(d[i]);
    }
    return buffer.toString();
  }

  /// Validador de formulário: obrigatório e com exatamente 11 dígitos (mesma
  /// regra do backend, que não confere dígito verificador).
  static String? validate(String? value) {
    final d = digits(value);
    if (d.isEmpty) return 'CPF é obrigatório.';
    if (d.length != length) return 'O CPF deve ter 11 dígitos.';
    return null;
  }
}

/// Máscara de digitação de CPF: aceita só dígitos (até 11) e reaplica a
/// pontuação a cada tecla, com o cursor no fim.
class CpfInputFormatter extends TextInputFormatter {
  const CpfInputFormatter();

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    var d = Cpf.digits(newValue.text);
    if (d.length > Cpf.length) d = d.substring(0, Cpf.length);
    final text = Cpf.format(d);
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}
