import 'package:flutter/foundation.dart';

import '../auth/auth_user.dart';
import '../storage/local_preferences.dart';

/// Tenant ativo da sessão — o valor que o [ApiClient] envia no header
/// `tenant-id` das rotas do RAG (documentos, chat).
///
/// Só aceita tenants em que o usuário está vinculado: o backend recusaria os
/// demais com `403 TENANT_OUT_OF_SCOPE`. A escolha persiste em
/// [LocalPreferences] (não é segredo) e é revalidada a cada sessão.
class TenantContext extends ChangeNotifier {
  TenantContext(this._preferences);

  final LocalPreferences _preferences;

  List<TenantRef> _available = const <TenantRef>[];
  String? _activeTenantId;

  /// Tenants disponíveis para o usuário logado.
  List<TenantRef> get available => _available;

  /// Id do tenant ativo; `null` = usuário sem vínculo (ou deslogado).
  String? get activeTenantId => _activeTenantId;

  TenantRef? get activeTenant {
    for (final tenant in _available) {
      if (tenant.id == _activeTenantId) return tenant;
    }
    return null;
  }

  /// Recalcula a partir da sessão: mantém o tenant salvo se ainda for um
  /// vínculo válido, senão cai no primeiro disponível.
  Future<void> syncWith(AuthUser? user) async {
    _available = user?.tenants ?? const <TenantRef>[];
    String? saved;
    try {
      saved = await _preferences.readActiveTenantId();
    } catch (error) {
      debugPrint('TenantContext: falha ao ler preferência ($error)');
    }
    final ids = _available.map((tenant) => tenant.id).toSet();
    _activeTenantId = ids.contains(saved)
        ? saved
        : (_available.isEmpty ? null : _available.first.id);
    notifyListeners();
  }

  /// Troca o tenant ativo. Ignora id fora dos vínculos.
  Future<void> select(String tenantId) async {
    if (!_available.any((tenant) => tenant.id == tenantId)) return;
    _activeTenantId = tenantId;
    notifyListeners();
    try {
      await _preferences.writeActiveTenantId(tenantId);
    } catch (error) {
      debugPrint('TenantContext: falha ao salvar preferência ($error)');
    }
  }

  /// Logout: esquece a lista em memória (a preferência salva é revalidada no
  /// próximo login).
  void clear() {
    _available = const <TenantRef>[];
    _activeTenantId = null;
    notifyListeners();
  }
}
