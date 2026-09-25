import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/modules/users/data/models/user_input.dart';
import 'package:geduc_rag/modules/users/data/models/user_model.dart';

void main() {
  test('UsersPage.fromJson lê o envelope paginado do backend', () {
    final page = UsersPage.fromJson(<String, dynamic>{
      'total': 42,
      'data': [
        {
          'id': 'u1',
          'name': 'Ana',
          'email': 'ana@rag.local',
          'active': false,
          'isSuperAdmin': true,
          'profiles': [
            {'id': 'p1', 'name': 'Administrador'},
          ],
          'tenants': [
            {'id': 't1', 'name': 'GEDUC', 'slug': 'geduc'},
          ],
        },
      ],
    });
    final user = page.items.single;
    expect(page.total, 42);
    expect(user.active, isFalse);
    expect(user.isSuperAdmin, isTrue);
    expect(user.profileIds, ['p1']);
    expect(user.tenantsLabel, 'GEDUC');
  });

  test('UpdateUserInput só envia os campos informados', () {
    expect(const UpdateUserInput(name: ' Ana ').toJson(), {'name': 'Ana'});
  });
}
