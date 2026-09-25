import '../../../../core/auth/auth_user.dart';

/// Referência `{id, name}` usada nos multiselects (perfil).
class IdName {
  const IdName({required this.id, required this.name});

  final String id;
  final String name;

  factory IdName.fromJson(Map<String, dynamic> json) => IdName(
    id: json['id']?.toString() ?? '',
    name: json['name']?.toString() ?? '',
  );
}

/// Usuário da plataforma (listagem/detalhe) — espelha o `UserResponseDto`.
/// Serialização manual.
class UserModel {
  const UserModel({
    required this.id,
    required this.name,
    required this.email,
    this.profiles = const <IdName>[],
    this.tenants = const <TenantRef>[],
    this.active = true,
    this.mustChangePassword = false,
    this.isSuperAdmin = false,
  });

  final String id;
  final String name;
  final String email;
  final List<IdName> profiles;
  final List<TenantRef> tenants;
  final bool active;
  final bool mustChangePassword;
  final bool isSuperAdmin;

  List<String> get profileIds => [for (final p in profiles) p.id];
  List<String> get tenantIds => [for (final t in tenants) t.id];

  String get profilesLabel =>
      profiles.isEmpty ? 'Sem perfil' : profiles.map((p) => p.name).join(', ');

  String get tenantsLabel =>
      tenants.isEmpty ? 'Sem tenant' : tenants.map((t) => t.name).join(', ');

  factory UserModel.fromJson(Map<String, dynamic> json) => UserModel(
    id: json['id']?.toString() ?? '',
    name: json['name']?.toString() ?? '',
    email: json['email']?.toString() ?? '',
    profiles: _list(json['profiles'], IdName.fromJson),
    tenants: _list(json['tenants'], TenantRef.fromJson),
    active: json['active'] != false,
    mustChangePassword: json['mustChangePassword'] == true,
    isSuperAdmin: json['isSuperAdmin'] == true,
  );

  static List<T> _list<T>(
    Object? raw,
    T Function(Map<String, dynamic>) parse,
  ) => raw is List
      ? raw.whereType<Map<String, dynamic>>().map(parse).toList(growable: false)
      : <T>[];
}

/// Página da listagem (`{ data, total }`).
class UsersPage {
  const UsersPage({required this.items, required this.total});

  final List<UserModel> items;
  final int total;

  factory UsersPage.fromJson(Map<String, dynamic> json) {
    final raw = json['data'];
    return UsersPage(
      items: raw is List
          ? raw
                .whereType<Map<String, dynamic>>()
                .map(UserModel.fromJson)
                .toList(growable: false)
          : const <UserModel>[],
      total: (json['total'] as num?)?.toInt() ?? 0,
    );
  }
}
