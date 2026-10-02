import '../../../core/errors/app_exception.dart';

/// Traduz o `code` de erro do backend em mensagem amigável (pt-BR) para as
/// telas do calendário acadêmico. Código desconhecido cai na mensagem do
/// backend e, sem ela, no [fallback].
String calendarErrorMessage(AppException error, {required String fallback}) {
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
  'CALENDAR_NOT_FOUND':
      'Calendário não encontrado. Ele pode ter sido excluído ou pertencer '
      'a outro tenant.',
  'CALENDAR_DAY_NOT_FOUND': 'Este dia está fora do período do calendário.',
  'CALENDAR_INVALID_RANGE':
      'O período deve estar dentro do ano letivo e o início não pode ser '
      'posterior ao fim.',
  'CALENDAR_SCHOOLS_INVALID':
      'Selecione ao menos uma escola válida do tenant, ou marque "Todas as '
      'escolas".',
  'CALENDAR_SUNDAY_IMMUTABLE':
      'O domingo é sempre dia não letivo; só a descrição pode ser alterada.',
  'SCHOOL_NOT_FOUND': 'Escola não encontrada.',
  'FORBIDDEN_PERMISSION': 'Você não tem permissão para realizar esta ação.',
  'TENANT_OUT_OF_SCOPE':
      'Você não tem acesso ao tenant selecionado. Troque o tenant ativo.',
  'TENANT_REQUIRED': 'Selecione um tenant para gerenciar o calendário.',
};

/// Executa [action] e devolve `null` em sucesso ou a mensagem amigável.
Future<String?> runCalendarAction(
  Future<void> Function() action, {
  required String fallback,
}) async {
  try {
    await action();
    return null;
  } on AppException catch (e) {
    return calendarErrorMessage(e, fallback: fallback);
  } catch (_) {
    return fallback;
  }
}
