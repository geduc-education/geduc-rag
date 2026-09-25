import 'package:geduc_rag/core/auth/auth_user.dart';
import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/modules/users/data/models/user_input.dart';
import 'package:geduc_rag/modules/users/data/models/user_model.dart';
import 'package:geduc_rag/modules/users/data/users_repository.dart';

/// Repositório fake: registra as chamadas e devolve dados fixos.
class FakeUsersRepository implements IUsersRepository {
  FakeUsersRepository({
    this.users = const <UserModel>[],
    this.total,
    this.profiles = const <IdName>[],
    this.tenants = const <TenantRef>[],
    this.failWith,
  });

  List<UserModel> users;
  int? total;
  List<IdName> profiles;
  List<TenantRef> tenants;
  AppException? failWith;

  final List<String> calls = <String>[];
  CreateUserInput? created;
  UpdateUserInput? updated;
  List<String>? tenantsSet;
  ({int page, String? search})? lastList;

  void _maybeFail() {
    final error = failWith;
    if (error != null) throw error;
  }

  @override
  Future<UsersPage> list({int page = 1, int limit = 20, String? search}) async {
    calls.add('list');
    lastList = (page: page, search: search);
    _maybeFail();
    return UsersPage(items: users, total: total ?? users.length);
  }

  @override
  Future<UserModel> create(CreateUserInput input) async {
    calls.add('create');
    _maybeFail();
    created = input;
    return UserModel(id: 'new', name: input.name, email: input.email);
  }

  @override
  Future<UserModel> update(String id, UpdateUserInput input) async {
    calls.add('update');
    _maybeFail();
    updated = input;
    return users.firstWhere((u) => u.id == id);
  }

  @override
  Future<UserModel> setTenants(String id, List<String> tenantIds) async {
    calls.add('setTenants');
    tenantsSet = tenantIds;
    return users.firstWhere((u) => u.id == id);
  }

  @override
  Future<UserModel> setActive(String id, {required bool active}) async {
    calls.add('setActive');
    _maybeFail();
    final user = users.firstWhere((u) => u.id == id);
    return UserModel(
      id: user.id,
      name: user.name,
      email: user.email,
      active: active,
    );
  }

  @override
  Future<void> resetPassword(String id, String password) async {
    calls.add('resetPassword');
    _maybeFail();
  }

  @override
  Future<void> remove(String id) async {
    calls.add('remove');
    _maybeFail();
  }

  @override
  Future<List<IdName>> listProfiles() async => profiles;

  @override
  Future<List<TenantRef>> listTenants() async => tenants;
}
