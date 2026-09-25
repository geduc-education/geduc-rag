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
        profiles: const <String>['Curador'],
        permissions: permissions,
        isSuperAdmin: false,
      ),
    );
  return HomeShellController(service);
}

List<NavDestination> _ragDestinations(HomeShellController controller) =>
    controller.visibleDestinations
        .where((d) => d.group == NavGroup.assistente)
        .toList();

void main() {
  test('document:read mostra Documentos e esconde Assistente', () {
    final rag = _ragDestinations(
      _controllerWith({AppPermissions.documentRead}),
    );
    expect(rag.map((d) => d.label), <String>['Documentos']);
    expect(rag.single.route, '/home/rag/documents');
  });

  test('chat:query mostra Assistente', () {
    final rag = _ragDestinations(_controllerWith({AppPermissions.chatQuery}));
    expect(rag.map((d) => d.label), <String>['Assistente']);
    expect(rag.single.route, '/home/rag/chat');
  });

  test('sem document:read nem chat:query, o grupo assistente some', () {
    final controller = _controllerWith({AppPermissions.userRead});
    expect(_ragDestinations(controller), isEmpty);
    expect(
      controller.sidebarLayout.sections.map((s) => s.group),
      isNot(contains(NavGroup.assistente)),
    );
  });

  test('rótulo do grupo é Assistente', () {
    expect(navGroupLabel(NavGroup.assistente), 'Assistente');
  });
}
