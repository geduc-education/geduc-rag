import '../../../core/errors/app_exception.dart';

/// Código do backend para sábado letivo sem aula.
const String kSaturdayWithoutLessons = 'SCHEDULE_SATURDAY_WITHOUT_LESSONS';

/// Código do backend para aula com registro (não pode mudar nem sair).
const String kScheduleHasRecords = 'SCHEDULE_HAS_RECORDS';

/// Traduz o `code` de erro do backend em mensagem amigável (pt-BR) para as
/// telas do horário semanal. Código desconhecido cai na mensagem do backend
/// e, sem ela, no [fallback].
String scheduleErrorMessage(AppException error, {required String fallback}) {
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
  'SCHEDULE_NOT_FOUND':
      'Horário não encontrado. Ele pode ter sido excluído ou pertencer a '
      'outro tenant.',
  'SCHEDULE_LESSON_NOT_FOUND': 'Aula não encontrada neste horário.',
  'SCHEDULE_INVALID_PERIOD':
      'A semana deve ir de segunda a domingo, tocar o ano letivo da turma e '
      'ser diferente da semana de origem.',
  'SCHEDULE_WEEK_TAKEN': 'A turma já tem horário para esta semana.',
  'SCHEDULE_CALENDAR_NOT_FOUND':
      'Nenhum dia da semana está coberto por um calendário acadêmico da '
      'escola da turma.',
  'SCHEDULE_LESSON_INVALID_TIME': 'O início da aula deve ser anterior ao fim.',
  'SCHEDULE_LESSON_OVERLAP':
      'Há aulas do mesmo dia no mesmo horário ou com horários que se cruzam.',
  'SCHEDULE_LESSON_SLOT_INVALID':
      'Um ou mais horários de aula não pertencem à escola da turma. '
      'Recarregue o horário.',
  'LESSON_SLOT_NOT_FOUND':
      'Horário de aula não encontrado. Ele pode ter sido excluído.',
  'SCHEDULE_LESSON_ON_NON_SCHOOL_DAY':
      'Só dias letivos podem ter aulas. Remova as aulas dos demais dias.',
  kSaturdayWithoutLessons:
      'O sábado é letivo e precisa de ao menos uma aula para salvar.',
  'SCHEDULE_SUBJECTS_INVALID':
      'Uma ou mais disciplinas não existem mais neste tenant.',
  kScheduleHasRecords:
      'Aulas com conteúdo ou frequência registrados não podem ser alteradas '
      'nem excluídas.',
  'SCHOOL_CLASS_NOT_FOUND': 'Turma não encontrada.',
  'FORBIDDEN_PERMISSION': 'Você não tem permissão para realizar esta ação.',
  'TENANT_OUT_OF_SCOPE':
      'Você não tem acesso ao tenant selecionado. Troque o tenant ativo.',
  'TENANT_REQUIRED': 'Selecione um tenant para gerenciar os horários.',
};

/// Executa [action] e devolve `null` em sucesso ou a mensagem amigável.
Future<String?> runScheduleAction(
  Future<void> Function() action, {
  required String fallback,
}) async {
  try {
    await action();
    return null;
  } on AppException catch (e) {
    return scheduleErrorMessage(e, fallback: fallback);
  } catch (_) {
    return fallback;
  }
}
