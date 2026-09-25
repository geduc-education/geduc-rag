import 'package:shared_preferences/shared_preferences.dart';

/// Preferências locais NÃO sensíveis, persistidas em `shared_preferences`.
/// Segredos (JWT) NUNCA passam por aqui — ficam no `SecureStorage`.
class LocalPreferences {
  static const String _sidebarCollapsedKey = 'sidebar_collapsed';
  static const String _rememberEmailKey = 'login_remember_email';
  static const String _rememberedEmailKey = 'login_remembered_email';
  static const String _activeTenantKey = 'active_tenant_id';

  /// Sidebar do shell encolhida (rail); `null` = nunca definida (expandida).
  Future<bool?> readSidebarCollapsed() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_sidebarCollapsedKey);
  }

  Future<void> writeSidebarCollapsed(bool collapsed) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_sidebarCollapsedKey, collapsed);
  }

  /// Flag "Lembrar meu e-mail" do login; `null` = nunca definida (o controller
  /// assume o default MARCADO). Senha NUNCA passa por aqui.
  Future<bool?> readRememberEmail() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_rememberEmailKey);
  }

  Future<void> writeRememberEmail(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_rememberEmailKey, value);
  }

  /// E-mail lembrado do último login; `null` = nenhum salvo.
  Future<String?> readRememberedEmail() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_rememberedEmailKey);
  }

  /// Persiste o e-mail lembrado; `null` REMOVE a chave.
  Future<void> writeRememberedEmail(String? email) async {
    final prefs = await SharedPreferences.getInstance();
    if (email == null) {
      await prefs.remove(_rememberedEmailKey);
    } else {
      await prefs.setString(_rememberedEmailKey, email);
    }
  }

  /// Último tenant ativo escolhido; `null` = nenhum (usa o primeiro vínculo).
  Future<String?> readActiveTenantId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_activeTenantKey);
  }

  /// Persiste o tenant ativo; `null` REMOVE a chave.
  Future<void> writeActiveTenantId(String? tenantId) async {
    final prefs = await SharedPreferences.getInstance();
    if (tenantId == null) {
      await prefs.remove(_activeTenantKey);
    } else {
      await prefs.setString(_activeTenantKey, tenantId);
    }
  }
}
