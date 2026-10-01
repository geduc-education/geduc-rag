/// Chaves de permissão (`recurso:ação`) consumidas pelo gating de UI.
///
/// Espelho de `backend/src/common/rbac/permissions.ts` — mudou lá, muda aqui.
/// Nenhuma tela usa string solta: sempre `AppPermissions.*`.
abstract final class AppPermissions {
  static const String userRead = 'user:read';
  static const String userManage = 'user:manage';

  static const String profileRead = 'profile:read';

  static const String tenantRead = 'tenant:read';
  static const String tenantManage = 'tenant:manage';

  static const String employeeRead = 'employee:read';
  static const String employeeManage = 'employee:manage';

  /// Exclusão DEFINITIVA (hard delete) de funcionário — separada do manage.
  static const String employeePurge = 'employee:purge';

  static const String documentRead = 'document:read';
  static const String documentManage = 'document:manage';
  static const String chatQuery = 'chat:query';
}
