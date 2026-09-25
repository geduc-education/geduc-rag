import 'package:flutter/foundation.dart';

import '../../../core/auth/auth_user.dart';
import '../../../core/errors/app_exception.dart';
import '../data/models/user_input.dart';
import '../data/models/user_model.dart';
import '../data/users_repository.dart';

/// Controller do formulário de usuário (criar/editar) com multiselect de
/// **perfis** (RBAC N:N) e de **tenants**.
///
/// As opções de tenant vêm do alcance do ator (`GET /tenants`). Na edição,
/// vínculos do usuário FORA desse alcance não aparecem na seleção e o backend
/// os preserva na substituição ([outOfScopeTenantCount] avisa a UI). As regras
/// "ninguém concede o que não tem" e "só tenants do seu alcance" são do
/// backend (403); aqui só se evita mandar o que certamente seria recusado.
class UserFormController extends ChangeNotifier {
  UserFormController(this._users, {this.editing});

  final IUsersRepository _users;

  /// Usuário em edição; `null` = criação.
  final UserModel? editing;

  bool get isEditing => editing != null;

  bool _loading = true;
  bool _saving = false;
  String? _error;
  List<IdName> _profiles = const <IdName>[];
  List<TenantRef> _tenants = const <TenantRef>[];
  late final Set<String> _selectedProfileIds = <String>{
    ...?editing?.profileIds,
  };
  late final Set<String> _selectedTenantIds = <String>{...?editing?.tenantIds};
  int _outOfScopeTenantCount = 0;

  bool get loading => _loading;
  bool get saving => _saving;
  String? get error => _error;
  List<IdName> get profiles => _profiles;
  List<TenantRef> get tenants => _tenants;
  Set<String> get selectedProfileIds => _selectedProfileIds;
  Set<String> get selectedTenantIds => _selectedTenantIds;
  int get outOfScopeTenantCount => _outOfScopeTenantCount;

  Future<void> bootstrap() async {
    _loading = true;
    notifyListeners();
    try {
      final results = await Future.wait<Object>(<Future<Object>>[
        _users.listProfiles(),
        _users.listTenants(),
      ]);
      _profiles = results[0] as List<IdName>;
      _tenants = results[1] as List<TenantRef>;
      _restrictTenantsToScope();
      if (!isEditing && _tenants.length == 1) {
        _selectedTenantIds.add(_tenants.single.id);
      }
    } on AppException catch (e) {
      _error = e.message;
    } catch (_) {
      _error = 'Não foi possível carregar perfis e tenants.';
    }
    _loading = false;
    notifyListeners();
  }

  /// Tira da seleção os tenants que o ator não enxerga — reenviá-los daria
  /// 403; o backend os preserva na substituição.
  void _restrictTenantsToScope() {
    final visible = <String>{for (final t in _tenants) t.id};
    final before = _selectedTenantIds.length;
    _selectedTenantIds.removeWhere((id) => !visible.contains(id));
    _outOfScopeTenantCount = before - _selectedTenantIds.length;
  }

  void toggleProfile(String id) {
    if (!_selectedProfileIds.remove(id)) _selectedProfileIds.add(id);
    notifyListeners();
  }

  void toggleTenant(String id) {
    if (!_selectedTenantIds.remove(id)) _selectedTenantIds.add(id);
    notifyListeners();
  }

  /// Persiste o usuário. Retorna `true` em sucesso. [password] só na criação.
  Future<bool> save({
    required String name,
    required String email,
    String? password,
  }) async {
    if (!isEditing && _selectedTenantIds.isEmpty && _tenants.isNotEmpty) {
      return _fail('Selecione ao menos um tenant.');
    }
    _saving = true;
    _error = null;
    notifyListeners();
    try {
      isEditing
          ? await _update(name, email)
          : await _users.create(
              CreateUserInput(
                name: name,
                email: email,
                password: password ?? '',
                profileIds: _selectedProfileIds.toList(),
                tenantIds: _selectedTenantIds.toList(),
              ),
            );
      _saving = false;
      notifyListeners();
      return true;
    } on AppException catch (e) {
      return _fail(e.message);
    } catch (_) {
      return _fail('Não foi possível salvar o usuário.');
    }
  }

  Future<void> _update(String name, String email) async {
    final id = editing!.id;
    await _users.update(
      id,
      UpdateUserInput(
        name: name,
        email: email,
        profileIds: _selectedProfileIds.toList(),
      ),
    );
    await _users.setTenants(id, _selectedTenantIds.toList());
  }

  bool _fail(String message) {
    _error = message;
    _saving = false;
    notifyListeners();
    return false;
  }
}
