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
        profiles: const <String>['Secretaria'],
        permissions: permissions,
        isSuperAdmin: false,
      ),
    );
  return HomeShellController(service);
}

Iterable<NavDestination> _calendar(HomeShellController controller) => controller
    .visibleDestinations
    .where((d) => d.label == 'Calendário Acadêmico');

void main() {
  test('employee:manage mostra o Calendário Acadêmico no topo', () {
    final controller = _controllerWith({AppPermissions.employeeManage});
    final item = _calendar(controller).single;
    expect(item.route, '/home/academic-calendar');
    expect(item.requiredPermissions, <String>[AppPermissions.employeeManage]);
    expect(controller.sidebarLayout.topLoose, contains(item));
  });

  test('sem employee:manage o item some', () {
    final controller = _controllerWith({AppPermissions.employeeRead});
    expect(_calendar(controller), isEmpty);
  });
}
