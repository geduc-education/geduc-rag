import '../../../core/errors/app_exception.dart';

/// Traduz o `code` de erro do backend em mensagem amigável (pt-BR) para as
/// telas de funcionários. Código desconhecido cai na mensagem do backend e,
/// sem ela, no [fallback].
String employeeErrorMessage(AppException error, {required String fallback}) {
  final known = _byCode[error.code];
  if (known != null) return known;
  if (error.code == 'VALIDATION_ERROR' || error.statusCode == 400) {
    return error.message.isEmpty
        ? 'Dados inválidos. Revise os campos.'
        : 'Dados inválidos: ${error.message}';
  }
  return error.message.isEmpty ? fallback : error.message;
}

const Map<String, String> _byCode = <String, String>{
  'EMPLOYEE_NOT_FOUND':
      'Funcionário não encontrado. Ele pode ter sido excluído ou pertencer '
      'a outro tenant.',
  'EMPLOYEE_EMAIL_TAKEN': 'Já existe um funcionário com este e-mail.',
  'EMPLOYEE_DOCUMENT_TAKEN': 'Já existe um funcionário com este CPF.',
  'EMPLOYEE_USER_ALREADY_LINKED':
      'Este usuário já está vinculado a outro funcionário.',
  'EMPLOYEE_USER_NOT_LINKABLE':
      'O usuário selecionado não existe ou não tem vínculo com este tenant.',
  'FORBIDDEN_PERMISSION': 'Você não tem permissão para realizar esta ação.',
  'TENANT_OUT_OF_SCOPE':
      'Você não tem acesso ao tenant selecionado. Troque o tenant ativo.',
  'TENANT_REQUIRED': 'Selecione um tenant para gerenciar funcionários.',
};
