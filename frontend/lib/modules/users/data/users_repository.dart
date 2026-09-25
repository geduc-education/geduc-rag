import '../../../core/auth/auth_user.dart';
import '../../../core/http/api_client.dart';
import 'models/user_input.dart';
import 'models/user_model.dart';

/// Contrato do repositório de usuários (e das opções do formulário).
abstract interface class IUsersRepository {
  Future<UsersPage> list({int page = 1, int limit = 20, String? search});
  Future<UserModel> create(CreateUserInput input);
  Future<UserModel> update(String id, UpdateUserInput input);

  /// Substitui os vínculos usuário ↔ tenant (`PUT /users/:id/tenants`).
  Future<UserModel> setTenants(String id, List<String> tenantIds);
  Future<UserModel> setActive(String id, {required bool active});

  /// Grava uma nova senha temporária (`POST /users/:id/reset-password`).
  Future<void> resetPassword(String id, String password);
  Future<void> remove(String id);

  /// Opções do multiselect de perfis (`GET /profiles`).
  Future<List<IdName>> listProfiles();

  /// Opções do multiselect de tenants — o alcance do ator (`GET /tenants`).
  Future<List<TenantRef>> listTenants();
}

class UsersRepository implements IUsersRepository {
  UsersRepository(this._client);

  final ApiClient _client;

  @override
  Future<UsersPage> list({int page = 1, int limit = 20, String? search}) async {
    final response = await _client.get<Map<String, dynamic>>(
      '/users',
      queryParameters: <String, dynamic>{
        'page': page,
        'limit': limit,
        if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      },
    );
    return UsersPage.fromJson(response.data ?? const <String, dynamic>{});
  }

  @override
  Future<UserModel> create(CreateUserInput input) async {
    final response = await _client.post<Map<String, dynamic>>(
      '/users',
      data: input.toJson(),
    );
    return _user(response.data);
  }

  @override
  Future<UserModel> update(String id, UpdateUserInput input) async {
    final response = await _client.patch<Map<String, dynamic>>(
      '/users/$id',
      data: input.toJson(),
    );
    return _user(response.data);
  }

  @override
  Future<UserModel> setTenants(String id, List<String> tenantIds) async {
    final response = await _client.put<Map<String, dynamic>>(
      '/users/$id/tenants',
      data: <String, dynamic>{'tenantIds': tenantIds},
    );
    return _user(response.data);
  }

  @override
  Future<UserModel> setActive(String id, {required bool active}) async {
    final action = active ? 'activate' : 'deactivate';
    final response = await _client.patch<Map<String, dynamic>>(
      '/users/$id/$action',
    );
    return _user(response.data);
  }

  @override
  Future<void> resetPassword(String id, String password) => _client.post<void>(
    '/users/$id/reset-password',
    data: <String, dynamic>{'password': password},
  );

  @override
  Future<void> remove(String id) => _client.delete<void>('/users/$id');

  @override
  Future<List<IdName>> listProfiles() async {
    final response = await _client.get<List<dynamic>>('/profiles');
    return _parseList(response.data, IdName.fromJson);
  }

  @override
  Future<List<TenantRef>> listTenants() async {
    final response = await _client.get<List<dynamic>>('/tenants');
    return _parseList(response.data, TenantRef.fromJson);
  }

  UserModel _user(Map<String, dynamic>? data) =>
      UserModel.fromJson(data ?? const <String, dynamic>{});

  List<T> _parseList<T>(
    List<dynamic>? raw,
    T Function(Map<String, dynamic>) parse,
  ) => (raw ?? const <dynamic>[])
      .whereType<Map<String, dynamic>>()
      .map(parse)
      .toList(growable: false);
}
