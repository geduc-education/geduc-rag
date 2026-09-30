import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/core/auth/auth_user.dart';
import 'package:geduc_rag/core/auth/permission_service.dart';
import 'package:geduc_rag/modules/home/presentation/home_shell_controller.dart';

void main() {
  test('Calendário Acadêmico aparece no topo para qualquer usuário', () {
    final service = PermissionService()
      ..setUser(
        const AuthUser(
          id: 'u1',
          name: 'Ana',
          email: 'ana@rag.local',
          profiles: <String>['Leitor'],
          permissions: <String>{},
          isSuperAdmin: false,
        ),
      );
    final controller = HomeShellController(service);
    final item = controller.visibleDestinations.singleWhere(
      (d) => d.label == 'Calendário Acadêmico',
    );
    expect(item.route, '/home/academic-calendar');
    expect(item.requiredPermissions, isEmpty);
    expect(controller.sidebarLayout.topLoose, contains(item));
  });
}
