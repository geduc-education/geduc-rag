/**
 * Catálogo de permissões da plataforma — fonte ÚNICA. O seed grava este
 * catálogo na tabela `permission` e os perfis default a partir de
 * `DEFAULT_PROFILES`; guards e services referenciam as chaves por
 * `PERMISSIONS.*` (nunca string solta).
 *
 * Formato `recurso:acao`. Espelho no frontend:
 * `frontend/lib/core/auth/app_permissions.dart` — mudou aqui, muda lá.
 */
export const PERMISSIONS = {
  // --- Usuários -----------------------------------------------------------
  USER_READ: 'user:read',
  USER_MANAGE: 'user:manage',

  // --- Perfis -------------------------------------------------------------
  PROFILE_READ: 'profile:read',

  // --- Tenants ------------------------------------------------------------
  TENANT_READ: 'tenant:read',
  TENANT_MANAGE: 'tenant:manage',

  // --- Funcionários -------------------------------------------------------
  EMPLOYEE_READ: 'employee:read',
  EMPLOYEE_MANAGE: 'employee:manage',
  EMPLOYEE_PURGE: 'employee:purge',

  // --- RAG ----------------------------------------------------------------
  DOCUMENT_READ: 'document:read',
  DOCUMENT_MANAGE: 'document:manage',
  CHAT_QUERY: 'chat:query',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Descrição de cada chave (vira `permission.description` no seed). */
export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  'user:read': 'Listar e visualizar usuários',
  'user:manage': 'Criar, editar, inativar e redefinir senha de usuários',
  'profile:read': 'Listar perfis e suas permissões',
  'tenant:read': 'Listar e visualizar tenants',
  'tenant:manage': 'Criar e editar tenants',
  'employee:read': 'Listar e visualizar funcionários do tenant',
  'employee:manage': 'Criar, editar e excluir funcionários do tenant',
  'employee:purge': 'Excluir funcionários do tenant definitivamente',
  'document:read': 'Consultar documentos e o status da ingestão',
  'document:manage': 'Enviar documentos para a base de conhecimento',
  'chat:query': 'Fazer perguntas ao assistente (RAG)',
};

export const ALL_PERMISSION_KEYS = Object.values(
  PERMISSIONS,
) as PermissionKey[];

/** Perfil default semeado (`Profile.system = true`, não removível). */
export interface DefaultProfile {
  name: string;
  description: string;
  permissions: PermissionKey[];
}

export const DEFAULT_PROFILES: DefaultProfile[] = [
  {
    name: 'Administrador',
    description: 'Gestão de usuários, tenants e da base de conhecimento',
    permissions: ALL_PERMISSION_KEYS,
  },
  {
    name: 'Curador',
    description: 'Mantém a base de conhecimento e usa o assistente',
    permissions: [
      PERMISSIONS.DOCUMENT_READ,
      PERMISSIONS.DOCUMENT_MANAGE,
      PERMISSIONS.CHAT_QUERY,
    ],
  },
  {
    name: 'Usuário',
    description: 'Consulta o assistente sobre a base de conhecimento',
    permissions: [PERMISSIONS.DOCUMENT_READ, PERMISSIONS.CHAT_QUERY],
  },
];
