import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/core/auth/auth_user.dart';
import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/modules/users/data/models/user_model.dart';
import 'package:geduc_rag/modules/users/presentation/user_form_controller.dart';

import '../support/fake_users_repository.dart';

const _tA = TenantRef(id: 'a', name: 'A');
const _tB = TenantRef(id: 'b', name: 'B');
const _admin = IdName(id: 'p1', name: 'Administrador');

void main() {
  test('criação com um único tenant disponível o pré-seleciona', () async {
    final repo = FakeUsersRepository(profiles: [_admin], tenants: [_tA]);
    final controller = UserFormController(repo);
    await controller.bootstrap();
    expect(controller.selectedTenantIds, {'a'});
  });

  test('criação exige tenant quando há opções', () async {
    final repo = FakeUsersRepository(tenants: [_tA, _tB]);
    final controller = UserFormController(repo);
    await controller.bootstrap();
    final ok = await controller.save(
      name: 'Ana',
      email: 'ana@rag.local',
      password: 'Senha!123',
    );
    expect(ok, isFalse);
    expect(controller.error, 'Selecione ao menos um tenant.');
    expect(repo.calls, isNot(contains('create')));
  });

  test('criação envia usuário, senha, perfis e tenants numa chamada', () async {
    final repo = FakeUsersRepository(profiles: [_admin], tenants: [_tA, _tB]);
    final controller = UserFormController(repo);
    await controller.bootstrap();
    controller
      ..toggleProfile('p1')
      ..toggleTenant('b');
    final ok = await controller.save(
      name: ' Ana ',
      email: 'ana@rag.local',
      password: 'Senha!123',
    );
    expect(ok, isTrue);
    expect(repo.created!.toJson(), <String, dynamic>{
      'name': 'Ana',
      'email': 'ana@rag.local',
      'password': 'Senha!123',
      'profileIds': ['p1'],
      'tenantIds': ['b'],
    });
  });

  test('edição preserva vínculos fora do alcance (não os reenvia)', () async {
    const editing = UserModel(
      id: 'u1',
      name: 'Ana',
      email: 'ana@rag.local',
      tenants: [
        _tA,
        TenantRef(id: 'fora', name: 'Fora'),
      ],
    );
    final repo = FakeUsersRepository(users: [editing], tenants: [_tA]);
    final controller = UserFormController(repo, editing: editing);
    await controller.bootstrap();
    expect(controller.outOfScopeTenantCount, 1);

    await controller.save(name: 'Ana', email: 'ana@rag.local');
    expect(repo.calls, ['update', 'setTenants']);
    expect(repo.tenantsSet, ['a']);
    expect(repo.updated!.toJson().containsKey('password'), isFalse);
  });

  test('erro do backend (403) aparece no formulário', () async {
    final repo = FakeUsersRepository(tenants: [_tA]);
    final controller = UserFormController(repo);
    await controller.bootstrap();
    repo.failWith = const AppException(
      message: 'Você não pode atribuir perfis com permissões que não possui.',
      statusCode: 403,
    );
    final ok = await controller.save(
      name: 'Ana',
      email: 'ana@rag.local',
      password: 'Senha!123',
    );
    expect(ok, isFalse);
    expect(controller.error, contains('não possui'));
  });
}
