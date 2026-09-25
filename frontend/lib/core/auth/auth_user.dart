/// Usuário autenticado (payload do login e do `/auth/me`).
///
/// [permissions] é a união das permissões dos perfis ativos, calculada no
/// backend; [tenants] são os vínculos que liberam o header `tenant-id`.
/// Serialização manual, padrão da casa.
class AuthUser {
  const AuthUser({
    required this.id,
    required this.name,
    required this.email,
    required this.profiles,
    required this.permissions,
    this.tenants = const <TenantRef>[],
    this.mustChangePassword = false,
    this.isSuperAdmin = false,
  });

  final String id;
  final String name;
  final String email;

  /// Nomes dos perfis atribuídos (ex.: "Administrador", "Curador").
  final List<String> profiles;

  /// Permissões efetivas (`recurso:ação`) — união dos perfis.
  final Set<String> permissions;

  /// Tenants vinculados (vazio para usuário sem vínculo).
  final List<TenantRef> tenants;

  /// `true` no primeiro acesso — força a troca de senha.
  final bool mustChangePassword;

  /// `true` para o SUPERADMIN de bootstrap (bypass de permissão e de tenant).
  final bool isSuperAdmin;

  /// Rótulo de papel exibido no rodapé da sidebar (perfis concatenados).
  String get roleLabel =>
      profiles.isEmpty ? 'Sem perfil' : profiles.join(' · ');

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    final rawProfiles = json['profiles'];
    final rawPermissions = json['permissions'];
    final rawTenants = json['tenants'];
    return AuthUser(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      profiles: rawProfiles is List
          ? rawProfiles.map((e) => e.toString()).toList()
          : const <String>[],
      permissions: rawPermissions is List
          ? rawPermissions.map((e) => e.toString()).toSet()
          : <String>{},
      tenants: rawTenants is List
          ? rawTenants
                .whereType<Map<String, dynamic>>()
                .map(TenantRef.fromJson)
                .toList(growable: false)
          : const <TenantRef>[],
      mustChangePassword: json['mustChangePassword'] == true,
      isSuperAdmin: json['isSuperAdmin'] == true,
    );
  }
}

/// Referência mínima de tenant (`{id, name, slug}`) — espelha o
/// `TenantSummaryDto` do backend.
class TenantRef {
  const TenantRef({required this.id, required this.name, this.slug = ''});

  final String id;
  final String name;
  final String slug;

  factory TenantRef.fromJson(Map<String, dynamic> json) => TenantRef(
    id: json['id']?.toString() ?? '',
    name: json['name']?.toString() ?? '',
    slug: json['slug']?.toString() ?? '',
  );
}
