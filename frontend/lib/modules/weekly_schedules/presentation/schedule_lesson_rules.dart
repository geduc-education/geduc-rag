import '../data/models/schedule_day.dart';

/// Validação local de uma aula no [day], espelho do backend: aula só em dia
/// letivo, aula registrada travada, disciplina e horário obrigatórios e o
/// mesmo horário de aula não se repete no dia. [replacing] é o índice da
/// aula em edição (ignorada na checagem de repetição). `null` = válida.
String? validateScheduleLesson(
  ScheduleDay day,
  ScheduleLesson draft, {
  int? replacing,
}) {
  if (!day.hasClass) {
    return 'Só dias letivos aceitam aulas (este dia: ${day.typeLabel}).';
  }
  if (replacing != null && day.lessons[replacing].isRecorded) {
    return lockedLessonMessage;
  }
  if (draft.subjectId.isEmpty) return 'Selecione a disciplina.';
  if (draft.lessonSlotId.isEmpty) return 'Selecione o horário da aula.';
  return _repeatedSlotMessage(day, draft, replacing);
}

/// Ids dos horários de aula já ocupados no [day], exceto o da aula
/// [except] (a aula em edição pode manter o próprio horário).
Set<String> usedLessonSlotIds(ScheduleDay day, {int? except}) => <String>{
  for (var i = 0; i < day.lessons.length; i++)
    if (i != except) day.lessons[i].lessonSlotId,
};

String? _repeatedSlotMessage(ScheduleDay day, ScheduleLesson draft, int? skip) {
  for (var i = 0; i < day.lessons.length; i++) {
    final other = day.lessons[i];
    if (i == skip || other.lessonSlotId != draft.lessonSlotId) continue;
    final name = other.subjectName.isEmpty ? 'outra aula' : other.subjectName;
    return 'Este horário já está ocupado neste dia pela aula de $name.';
  }
  return null;
}

/// Aula com conteúdo/frequência registrados não pode mudar nem sair.
const String lockedLessonMessage =
    'Esta aula tem conteúdo ou frequência registrados e não pode ser '
    'alterada nem excluída.';

/// Escola da turma sem horários de aula: nada a escolher no diálogo.
const String noLessonSlotsMessage =
    'A escola desta turma não tem horários de aula cadastrados. Cadastre-os '
    'na aba Escolas (editar a escola → Horários das aulas) para incluir '
    'aulas.';
