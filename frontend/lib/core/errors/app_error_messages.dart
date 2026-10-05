import 'app_exception.dart';

/// Traduz o `code` de erro do backend em mensagem amigável (pt-BR).
///
/// Ordem: [byCode] do domínio → códigos comuns (permissão/tenant) → erro de
/// validação (400) → mensagem do backend → [fallback].
String appErrorMessage(
  AppException error, {
  required String fallback,
  Map<String, String> byCode = const <String, String>{},
}) {
  final known = byCode[error.code] ?? _commonByCode[error.code];
  if (known != null) return known;
  if (error.code == 'VALIDATION_ERROR' || error.statusCode == 400) {
    return error.message.isEmpty
        ? 'Dados inválidos. Revise os campos.'
        : 'Dados inválidos: ${error.message}';
  }
  return error.message.isEmpty ? fallback : error.message;
}

const Map<String, String> _commonByCode = <String, String>{
  'FORBIDDEN_PERMISSION': 'Você não tem permissão para realizar esta ação.',
  'TENANT_OUT_OF_SCOPE':
      'Você não tem acesso ao tenant selecionado. Troque o tenant ativo.',
  'TENANT_REQUIRED': 'Selecione um tenant para continuar.',
};
