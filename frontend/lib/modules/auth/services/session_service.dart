import '../../../core/auth/auth_user.dart';
import '../../../core/auth/permission_service.dart';
import '../../../core/storage/secure_storage.dart';
import '../../../core/tenancy/tenant_context.dart';
import '../data/auth_repository.dart';
import '../data/models/change_password_input.dart';
import '../data/models/login_input.dart';

/// Orquestra o ciclo de vida da sessão: login, troca de senha obrigatória,
/// rehidratação a partir do token persistido e logout.
///
/// Fonte única da sessão no frontend — persiste o JWT no [SecureStorage],
/// reflete o usuário no [PermissionService] (gating de UI) e os vínculos no
/// [TenantContext] (header `tenant-id`). Controllers dependem deste serviço,
/// nunca do repositório, para não duplicar a persistência do token.
class SessionService {
  SessionService(
    this._repository,
    this._storage,
    this._permissions, {
    TenantContext? tenants,
  }) : _tenants = tenants;

  final IAuthRepository _repository;
  final SecureStorage _storage;
  final PermissionService _permissions;

  /// Opcional em testes que não exercitam tenancy.
  final TenantContext? _tenants;

  AuthUser? get currentUser => _permissions.user;

  bool get mustChangePassword => _permissions.user?.mustChangePassword ?? false;

  Future<AuthUser> login(String email, String password) async {
    final response = await _repository.login(
      LoginInput(email: email, password: password),
    );
    await _persist(response.accessToken, response.user);
    return response.user;
  }

  /// Conclui a troca de senha: o token novo (`mustChangePassword:false`)
  /// substitui o atual e a sessão é atualizada.
  Future<AuthUser> changePassword(
    String currentPassword,
    String newPassword,
    String confirmPassword,
  ) async {
    final response = await _repository.changePassword(
      ChangePasswordInput(
        currentPassword: currentPassword,
        newPassword: newPassword,
        confirmPassword: confirmPassword,
      ),
    );
    await _persist(response.accessToken, response.user);
    return response.user;
  }

  /// Rehidrata a sessão a partir do token salvo. Falha silenciosa (token
  /// expirado/ausente) → deslogado.
  Future<bool> restore() async {
    final token = await _storage.readToken();
    if (token == null || token.isEmpty) return false;
    try {
      await _setUser(await _repository.me());
      return true;
    } catch (_) {
      await logout();
      return false;
    }
  }

  /// Encerra a sessão: limpa token, usuário e tenant ativo. Idempotente.
  Future<void> logout() async {
    await _storage.clearToken();
    _tenants?.clear();
    _permissions.clear();
  }

  Future<void> _persist(String token, AuthUser user) async {
    if (token.isNotEmpty) await _storage.writeToken(token);
    await _setUser(user);
  }

  Future<void> _setUser(AuthUser user) async {
    await _tenants?.syncWith(user);
    _permissions.setUser(user);
  }
}
