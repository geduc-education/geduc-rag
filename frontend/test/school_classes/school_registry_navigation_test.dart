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
      ),
    );
  return HomeShellController(service);
}

const Map<String, String> _expectedRoutes = <String, String>{
  'Escolas': '/home/schools',
  'Disciplinas': '/home/subjects',
  'Turmas': '/home/school-classes',
  'Horário Semanal': '/home/weekly-schedules',
};

void main() {
  test('employee:manage mostra a seção Acadêmico com os 4 itens', () {
    final controller = _controllerWith({AppPermissions.employeeManage});
    final section = controller.sidebarLayout.sections.firstWhere(
      (s) => s.group == NavGroup.academico,
    );
    expect({
      for (final item in section.items) item.label: item.route,
    }, _expectedRoutes);
    for (final item in section.items) {
      expect(item.requiredPermissions, [AppPermissions.employeeManage]);
      expect(item.description, isNotNull);
      expect(item.description!.length, lessThanOrEqualTo(28));
    }
  });

  test('sem employee:manage a seção Acadêmico some', () {
    final controller = _controllerWith({AppPermissions.employeeRead});
    expect(
      controller.sidebarLayout.sections.map((s) => s.group),
      isNot(contains(NavGroup.academico)),
    );
  });

  test('rótulos do grupo Acadêmico', () {
    expect(navGroupLabel(NavGroup.academico), 'Acadêmico');
    expect(navGroupOrder.first, NavGroup.academico);
  });
}
