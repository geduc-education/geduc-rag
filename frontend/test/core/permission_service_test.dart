import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/core/auth/app_permissions.dart';
import 'package:geduc_rag/core/auth/auth_user.dart';
import 'package:geduc_rag/core/auth/permission_service.dart';

AuthUser _user({Set<String> permissions = const {}, bool superAdmin = false}) =>
    AuthUser(
      id: 'u1',
      name: 'Ana',
      email: 'ana@rag.local',
      profiles: const <String>['Curador'],
      permissions: permissions,
      isSuperAdmin: superAdmin,
    );

void main() {
  test('deslogado não tem permissão alguma', () {
    final service = PermissionService();
    expect(service.isAuthenticated, isFalse);
    expect(service.can(AppPermissions.userRead), isFalse);
  });

  test('can/canAny/canAll seguem a união dos perfis', () {
    final service = PermissionService()
      ..setUser(_user(permissions: {AppPermissions.userRead}));
    expect(service.can(AppPermissions.userRead), isTrue);
    expect(service.can(AppPermissions.userManage), isFalse);
    expect(
      service.canAny([AppPermissions.userManage, AppPermissions.userRead]),
      isTrue,
    );
    expect(
      service.canAll([AppPermissions.userManage, AppPermissions.userRead]),
      isFalse,
    );
    expect(service.canAny(const <String>[]), isTrue);
  });

  test('SUPERADMIN libera tudo', () {
    final service = PermissionService()..setUser(_user(superAdmin: true));
    expect(service.can(AppPermissions.tenantManage), isTrue);
  });

  test('AuthUser.fromJson lê perfis, permissões e tenants', () {
    final user = AuthUser.fromJson(<String, dynamic>{
      'id': 'u1',
      'name': 'Ana',
      'email': 'ana@rag.local',
      'profiles': ['Administrador'],
      'permissions': ['user:read'],
      'tenants': [
        {'id': 't1', 'name': 'GEDUC', 'slug': 'geduc'},
      ],
      'mustChangePassword': true,
    });
    expect(user.permissions, {'user:read'});
    expect(user.tenants.single.slug, 'geduc');
    expect(user.mustChangePassword, isTrue);
    expect(user.roleLabel, 'Administrador');
  });
}
