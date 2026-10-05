/// Mensagens amigáveis dos códigos de erro do cadastro escolar (escolas,
/// disciplinas, turmas e horários de aula) — espelho de
/// `backend/src/common/errors/error-codes.ts`.
/// Usadas com `appErrorMessage(..., byCode: ...)`.
library;

const Map<String, String> schoolErrorMessages = <String, String>{
  'SCHOOL_NOT_FOUND':
      'Escola não encontrada. Ela pode ter sido excluída ou pertencer a '
      'outro tenant.',
  'SCHOOL_NAME_TAKEN':
      'Já existe uma escola com este nome (inclusive entre as excluídas).',
};

const Map<String, String> subjectErrorMessages = <String, String>{
  'SUBJECT_NOT_FOUND':
      'Disciplina não encontrada. Ela pode ter sido excluída ou pertencer a '
      'outro tenant.',
  'SUBJECT_NAME_TAKEN':
      'Já existe uma disciplina com este nome (inclusive entre as excluídas).',
};

const Map<String, String> schoolClassErrorMessages = <String, String>{
  'SCHOOL_CLASS_NOT_FOUND':
      'Turma não encontrada. Ela pode ter sido excluída ou pertencer a '
      'outro tenant.',
  'SCHOOL_CLASS_NAME_TAKEN':
      'Já existe uma turma com este nome nesta escola e ano letivo.',
  'SCHOOL_CLASS_SCHOOL_INVALID':
      'A escola selecionada não existe, foi excluída ou está inativa.',
  'SCHOOL_NOT_FOUND': 'Escola não encontrada.',
};

const Map<String, String> lessonSlotErrorMessages = <String, String>{
  'LESSON_SLOT_INVALID_RANGE': 'O fim do horário deve ser depois do início.',
  'LESSON_SLOT_OVERLAP':
      'Este horário se sobrepõe a outro horário de aula da escola.',
  'LESSON_SLOT_NAME_TAKEN': 'Já existe um horário com este nome na escola.',
  'LESSON_SLOT_NOT_FOUND':
      'Horário de aula não encontrado. Ele pode ter sido excluído.',
  'LESSON_SLOT_IN_USE':
      'Este horário é usado em aulas do horário semanal e não pode ser '
      'excluído.',
  'SCHOOL_NOT_FOUND': 'Escola não encontrada.',
};
