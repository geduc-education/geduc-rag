import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/core/auth/app_permissions.dart';
import 'package:geduc_rag/core/auth/auth_user.dart';
import 'package:geduc_rag/core/auth/permission_service.dart';
import 'package:geduc_rag/core/routing/nav_destinations.dart';
import 'package:geduc_rag/modules/home/presentation/home_shell_controller.dart';

HomeShellController _controllerWith(Set<String> permissions) {
  final service = PermissionService()
    ..setUser(
      AuthUser(
        id: 'u1',
        name: 'Ana',
        email: 'ana@rag.local',
        profiles: const <String>['RH'],
        permissions: permissions,
      ),
    );
  return HomeShellController(service);
}

Iterable<NavDestination> _employees(HomeShellController controller) =>
    controller.visibleDestinations.where((d) => d.label == 'Funcionários');

void main() {
  test('employee:read mostra Funcionários em Administração', () {
    final items = _employees(
      _controllerWith({AppPermissions.employeeRead}),
    ).toList();
    expect(items, hasLength(1));
    expect(items.single.route, '/home/employees');
    expect(items.single.group, NavGroup.administracao);
  });

  test('sem employee:read o item some', () {
    final controller = _controllerWith({
      AppPermissions.employeeManage,
      AppPermissions.employeePurge,
    });
    expect(_employees(controller), isEmpty);
  });

  test('chave de purge espelha o backend', () {
    expect(AppPermissions.employeePurge, 'employee:purge');
  });
}
