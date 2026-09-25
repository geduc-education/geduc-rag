/// Validadores de formulário reutilizáveis. Todos retornam `null` quando
/// válidos e uma mensagem em pt-BR caso contrário.
abstract final class Validators {
  static final RegExp _email = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

  static String? required(String? value, {String field = 'Campo'}) {
    if (value == null || value.trim().isEmpty) return '$field é obrigatório.';
    return null;
  }

  static String? email(String? value) {
    final base = required(value, field: 'E-mail');
    if (base != null) return base;
    if (!_email.hasMatch(value!.trim())) return 'Informe um e-mail válido.';
    return null;
  }

  static String? password(String? value, {int min = 8}) {
    final base = required(value, field: 'Senha');
    if (base != null) return base;
    if (value!.length < min) {
      return 'A senha deve ter ao menos $min caracteres.';
    }
    return null;
  }

  /// Confirma que [value] é igual a [other] (confirmação de nova senha).
  static String? confirm(String? value, String? other) {
    if (value != other) return 'As senhas não coincidem.';
    return null;
  }
}
