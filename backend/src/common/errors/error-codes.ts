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
