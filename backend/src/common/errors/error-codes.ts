/**
 * Catálogo dos códigos de erro de negócio da API — fonte única.
 *
 * Todo código novo entra aqui em vez de virar string inline no service (mesma
 * convenção do geduc-suporte). Agrupado por domínio, não por módulo emissor.
 */
export const ERROR_CODES = {
  // --- Autenticação -------------------------------------------------------
  /** Conta inativa tentando autenticar. 401. */
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  /** Confirmação de senha diferente da nova senha. 400. */
  PASSWORD_MISMATCH: 'PASSWORD_MISMATCH',
  /** Senha atual incorreta na troca de senha. 400. */
  INVALID_CURRENT_PASSWORD: 'INVALID_CURRENT_PASSWORD',
  /** Rota autenticada com troca de senha obrigatória pendente. 403. */
  PASSWORD_CHANGE_REQUIRED: 'PASSWORD_CHANGE_REQUIRED',
  /** Usuário sem a permissão exigida pela rota. 403. */
  FORBIDDEN_PERMISSION: 'FORBIDDEN_PERMISSION',

  // --- Tenancy ------------------------------------------------------------
  /** Header `tenant-id` ausente ou malformado em rota escopada. 400. */
  TENANT_REQUIRED: 'TENANT_REQUIRED',
  /**
   * Tenant inexistente, inativo ou sem vínculo com o usuário — mesma resposta
   * nos três casos, para não permitir enumeração pelo header. 403.
   */
  TENANT_OUT_OF_SCOPE: 'TENANT_OUT_OF_SCOPE',
  /** Um ou mais `tenantIds` informados não existem. 400. */
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  /** `slug` de tenant já usado (inclusive por tenant excluído). 409. */
  TENANT_SLUG_TAKEN: 'TENANT_SLUG_TAKEN',
  /**
   * Vincular/desvincular tenant fora do alcance do ator. Sem esta barreira um
   * administrador do tenant A se vincularia ao B e leria os documentos dele.
   * 403.
   */
  TENANT_NOT_GRANTABLE: 'TENANT_NOT_GRANTABLE',

  // --- Perfis e permissões ------------------------------------------------
  /** Um ou mais `profileIds` inexistentes ou inativos. 400. */
  PROFILE_NOT_FOUND: 'PROFILE_NOT_FOUND',
  /**
   * Atribuir perfil com permissão que o próprio ator não tem — o vetor de
   * escalada de privilégio ("ninguém concede o que não tem"). 403.
   */
  PERMISSION_NOT_GRANTABLE: 'PERMISSION_NOT_GRANTABLE',

  // --- Usuários -----------------------------------------------------------
  /**
   * E-mail já usado por outro usuário. Resposta NEUTRA de propósito: mesma
   * mensagem exista o usuário dentro ou fora do alcance do ator. 409.
   */
  EMAIL_UNAVAILABLE: 'EMAIL_UNAVAILABLE',
  /** Usuário fora do alcance do ator ou inexistente. 404. */
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  /** Operação destrutiva sobre o SUPERADMIN de bootstrap. 403. */
  USER_PROTECTED: 'USER_PROTECTED',
  /** O ator tentou inativar/excluir a si mesmo. 403. */
  USER_SELF_ACTION: 'USER_SELF_ACTION',
  /** Redefinir senha de usuário inativo (reative antes). 409. */
  USER_INACTIVE: 'USER_INACTIVE',

  // --- Funcionários -------------------------------------------------------
  /** Funcionário inexistente, excluído ou de outro tenant. 404. */
  EMPLOYEE_NOT_FOUND: 'EMPLOYEE_NOT_FOUND',
  /** E-mail já usado por outro funcionário do tenant (inclusive excluído). 409. */
  EMPLOYEE_EMAIL_TAKEN: 'EMPLOYEE_EMAIL_TAKEN',
  /** CPF já usado por outro funcionário do tenant (inclusive excluído). 409. */
  EMPLOYEE_DOCUMENT_TAKEN: 'EMPLOYEE_DOCUMENT_TAKEN',
  /**
   * `userId` inexistente, excluído ou sem vínculo com o tenant — mesma
   * resposta nos três casos, para não revelar usuário fora do alcance. 400.
   */
  EMPLOYEE_USER_NOT_LINKABLE: 'EMPLOYEE_USER_NOT_LINKABLE',
  /** O usuário já está vinculado a outro funcionário do tenant. 409. */
  EMPLOYEE_USER_ALREADY_LINKED: 'EMPLOYEE_USER_ALREADY_LINKED',

  // --- Escolas ------------------------------------------------------------
  /** Escola inexistente, excluída ou de outro tenant. 404. */
  SCHOOL_NOT_FOUND: 'SCHOOL_NOT_FOUND',
  /** Nome já usado por outra escola do tenant (inclusive excluída). 409. */
  SCHOOL_NAME_TAKEN: 'SCHOOL_NAME_TAKEN',

  // --- Horários de aula da escola -----------------------------------------
  /** Horário de aula inexistente, excluído ou de outra escola/tenant. 404. */
  LESSON_SLOT_NOT_FOUND: 'LESSON_SLOT_NOT_FOUND',
  /** Fim do horário igual ou anterior ao início. 400. */
  LESSON_SLOT_INVALID_RANGE: 'LESSON_SLOT_INVALID_RANGE',
  /** Horário que cruza outro horário (não excluído) da mesma escola. 409. */
  LESSON_SLOT_OVERLAP: 'LESSON_SLOT_OVERLAP',
  /** Nome já usado por outro horário (não excluído) da mesma escola. 409. */
  LESSON_SLOT_NAME_TAKEN: 'LESSON_SLOT_NAME_TAKEN',
  /** Excluir horário usado por aula de horário semanal não excluído. 409. */
  LESSON_SLOT_IN_USE: 'LESSON_SLOT_IN_USE',

  // --- Calendário acadêmico -----------------------------------------------
  /** Calendário inexistente, excluído ou de outro tenant. 404. */
  CALENDAR_NOT_FOUND: 'CALENDAR_NOT_FOUND',
  /** Data fora do intervalo do calendário. 404. */
  CALENDAR_DAY_NOT_FOUND: 'CALENDAR_DAY_NOT_FOUND',
  /** Início depois do fim ou alguma data fora do ano letivo informado. 400. */
  CALENDAR_INVALID_RANGE: 'CALENDAR_INVALID_RANGE',
  /** Um ou mais `schoolIds` inexistentes, excluídos ou de outro tenant. 400. */
  CALENDAR_SCHOOLS_INVALID: 'CALENDAR_SCHOOLS_INVALID',
  /** Tentativa de mudar o tipo de um domingo (sempre dia não letivo). 400. */
  CALENDAR_SUNDAY_IMMUTABLE: 'CALENDAR_SUNDAY_IMMUTABLE',

  // --- Disciplinas --------------------------------------------------------
  /** Disciplina inexistente, excluída ou de outro tenant. 404. */
  SUBJECT_NOT_FOUND: 'SUBJECT_NOT_FOUND',
  /** Nome já usado por outra disciplina do tenant (inclusive excluída). 409. */
  SUBJECT_NAME_TAKEN: 'SUBJECT_NAME_TAKEN',

  // --- Turmas -------------------------------------------------------------
  /** Turma inexistente, excluída ou de outro tenant. 404. */
  SCHOOL_CLASS_NOT_FOUND: 'SCHOOL_CLASS_NOT_FOUND',
  /** Nome já usado por outra turma da mesma escola e ano letivo. 409. */
  SCHOOL_CLASS_NAME_TAKEN: 'SCHOOL_CLASS_NAME_TAKEN',
  /** `schoolId` inexistente, excluído ou de outro tenant. 400. */
  SCHOOL_CLASS_SCHOOL_INVALID: 'SCHOOL_CLASS_SCHOOL_INVALID',

  // --- Horário semanal ----------------------------------------------------
  /** Horário semanal inexistente, excluído ou de outro tenant. 404. */
  SCHEDULE_NOT_FOUND: 'SCHEDULE_NOT_FOUND',
  /** Aula inexistente no horário informado. 404. */
  SCHEDULE_LESSON_NOT_FOUND: 'SCHEDULE_LESSON_NOT_FOUND',
  /**
   * Semana que não começa na segunda, não tem 7 dias, não toca o ano letivo
   * da turma ou dia informado fora da semana/repetido. 400.
   */
  SCHEDULE_INVALID_PERIOD: 'SCHEDULE_INVALID_PERIOD',
  /** A turma já tem horário para essa semana. 409. */
  SCHEDULE_WEEK_TAKEN: 'SCHEDULE_WEEK_TAKEN',
  /** Nenhuma data da semana coberta por calendário aplicável à turma. 400. */
  SCHEDULE_CALENDAR_NOT_FOUND: 'SCHEDULE_CALENDAR_NOT_FOUND',
  /**
   * Aula com início igual ou posterior ao fim. 400. Não é mais emitido desde
   * que as horas vêm do horário da escola (`LESSON_SLOT_INVALID_RANGE`);
   * mantido no catálogo por compatibilidade com clientes.
   */
  SCHEDULE_LESSON_INVALID_TIME: 'SCHEDULE_LESSON_INVALID_TIME',
  /** O mesmo horário de aula repetido no mesmo dia. 400. */
  SCHEDULE_LESSON_OVERLAP: 'SCHEDULE_LESSON_OVERLAP',
  /** `lessonSlotId` inexistente, excluído ou de outra escola que não a da turma. 400. */
  SCHEDULE_LESSON_SLOT_INVALID: 'SCHEDULE_LESSON_SLOT_INVALID',
  /** Aula em dia que não é letivo (ou sem calendário). 400. */
  SCHEDULE_LESSON_ON_NON_SCHOOL_DAY: 'SCHEDULE_LESSON_ON_NON_SCHOOL_DAY',
  /** Sábado letivo sem nenhuma aula. 400. */
  SCHEDULE_SATURDAY_WITHOUT_LESSONS: 'SCHEDULE_SATURDAY_WITHOUT_LESSONS',
  /** Uma ou mais `subjectId` inexistentes, excluídas ou de outro tenant. 400. */
  SCHEDULE_SUBJECTS_INVALID: 'SCHEDULE_SUBJECTS_INVALID',
  /** Alterar/remover aula com conteúdo ou frequência registrados. 409. */
  SCHEDULE_HAS_RECORDS: 'SCHEDULE_HAS_RECORDS',

  // --- Documentos ---------------------------------------------------------
  /** Upload acima de `DOCUMENT_MAX_UPLOAD_BYTES` (MulterError LIMIT_FILE_SIZE). 413. */
  ATTACHMENT_TOO_LARGE: 'ATTACHMENT_TOO_LARGE',
  /** Arquivo fora dos formatos aceitos (.md, .txt, .pdf, .docx). 400. */
  UNSUPPORTED_DOCUMENT_TYPE: 'UNSUPPORTED_DOCUMENT_TYPE',
  /** Documento sem texto extraível (ex.: PDF escaneado). 400. */
  DOCUMENT_TEXT_EMPTY: 'DOCUMENT_TEXT_EMPTY',

  // --- Changelog ----------------------------------------------------------
  /** GitHub indisponível (falha, timeout ou limite) e sem cache para servir. 502. */
  CHANGELOG_SOURCE_UNAVAILABLE: 'CHANGELOG_SOURCE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
