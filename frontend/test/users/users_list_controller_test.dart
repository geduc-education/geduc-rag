import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/modules/users/data/models/user_model.dart';
import 'package:geduc_rag/modules/users/presentation/users_list_controller.dart';

import '../support/fake_users_repository.dart';

const _ana = UserModel(id: 'u1', name: 'Ana', email: 'ana@rag.local');

void main() {
  test('carrega e vai para ready; lista vazia vira empty', () async {
    final repo = FakeUsersRepository(users: [_ana]);
    final controller = UsersListController(repo);
    await controller.load();
    expect(controller.state, ViewState.ready);

    repo.users = const [];
    await controller.load();
    expect(controller.state, ViewState.empty);
  });

  test('erro do backend vira estado de erro com a mensagem', () async {
    final repo = FakeUsersRepository(
      failWith: const AppException(message: 'Sem acesso', statusCode: 403),
    );
    final controller = UsersListController(repo);
    await controller.load();
    expect(controller.state, ViewState.error);
    expect(controller.error, 'Sem acesso');
  });

  test('paginação respeita o total e a busca volta à página 1', () async {
    final repo = FakeUsersRepository(users: [_ana], total: 45);
    final controller = UsersListController(repo, pageSize: 20);
    await controller.load();
    expect(controller.pageCount, 3);
    await controller.nextPage();
    await controller.nextPage();
    expect(controller.page, 3);
    expect(controller.hasNext, isFalse);

    await controller.search('ana');
    expect(repo.lastList, (page: 1, search: 'ana'));
  });

  test('toggleActive substitui o item na lista', () async {
    final repo = FakeUsersRepository(users: [_ana]);
    final controller = UsersListController(repo);
    await controller.load();
    expect(await controller.toggleActive(_ana), isNull);
    expect(controller.users.single.active, isFalse);
  });

  test('ação com erro devolve a mensagem para o toast', () async {
    final repo = FakeUsersRepository(users: [_ana]);
    final controller = UsersListController(repo);
    await controller.load();
    repo.failWith = const AppException(message: 'Usuário protegido');
    expect(await controller.remove(_ana), 'Usuário protegido');
  });
}
