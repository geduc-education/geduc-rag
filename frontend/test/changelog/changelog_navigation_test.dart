import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/core/auth/auth_user.dart';
import 'package:geduc_rag/core/auth/permission_service.dart';
import 'package:geduc_rag/modules/changelog/data/models/changelog_entry.dart';
import 'package:geduc_rag/modules/changelog/presentation/widgets/changelog_type_badge.dart';
import 'package:geduc_rag/modules/home/presentation/home_shell_controller.dart';

HomeShellController _controllerWithoutPermissions() {
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
  return HomeShellController(service);
}

void main() {
  test('Novidades aparece para usuário sem permissões, no rodapé', () {
    final controller = _controllerWithoutPermissions();
    final item = controller.visibleDestinations.singleWhere(
      (d) => d.label == 'Novidades',
    );
    expect(item.route, '/home/changelog');
    expect(item.requiredPermissions, isEmpty);
    expect(item.group, isNull);
    expect(controller.sidebarLayout.bottomLoose, contains(item));
  });

  test('rótulo curto e ícone para cada ChangelogType', () {
    for (final type in ChangelogType.values) {
      expect(changelogTypeShortLabels.containsKey(type), isTrue);
      expect(changelogTypeIcons.containsKey(type), isTrue);
    }
  });
}
