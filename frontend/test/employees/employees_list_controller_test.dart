import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/core/auth/auth_user.dart';
import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/core/storage/local_preferences.dart';
import 'package:geduc_rag/core/tenancy/tenant_context.dart';
import 'package:geduc_rag/modules/employees/data/models/employee_model.dart';
import 'package:geduc_rag/modules/employees/presentation/employees_list_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/fake_employees_repository.dart';

const _joao = EmployeeModel(
  id: 'e1',
  name: 'João',
  email: 'joao@escola.com',
  document: '12345678909',
);

int _listCalls(FakeEmployeesRepository repo) =>
    repo.calls.where((c) => c == 'list').length;

void main() {
  test('carrega e vai para ready; lista vazia vira empty', () async {
    final repo = FakeEmployeesRepository(employees: [_joao]);
    final controller = EmployeesListController(repo);
    await controller.load();
    expect(controller.state, EmployeesViewState.ready);

    repo.employees = const [];
    await controller.load();
    expect(controller.state, EmployeesViewState.empty);
  });

  test('erro com code conhecido vira mensagem amigável', () async {
    final repo = FakeEmployeesRepository(
      failWith: const AppException(
        message: 'Tenant fora do escopo',
        statusCode: 403,
        code: 'TENANT_OUT_OF_SCOPE',
      ),
    );
    final controller = EmployeesListController(repo);
    await controller.load();
    expect(controller.state, EmployeesViewState.error);
    expect(controller.error, contains('tenant selecionado'));
  });

  test('busca e filtro voltam à página 1 e vão na query', () async {
    final repo = FakeEmployeesRepository(employees: [_joao], total: 45);
    final controller = EmployeesListController(repo, pageSize: 20);
    await controller.load();
    expect(controller.pageCount, 3);
    await controller.nextPage();
    expect(controller.page, 2);

    await controller.setFilter(EmployeeActiveFilter.inactive);
    expect(repo.lastList, (page: 1, search: '', active: false));

    await controller.nextPage();
    await controller.search('123.456');
    expect(repo.lastList, (page: 1, search: '123.456', active: false));

    await controller.setFilter(EmployeeActiveFilter.all);
    expect(repo.lastList?.active, isNull);
  });

  test('remove chama a exclusão lógica e recarrega', () async {
    final repo = FakeEmployeesRepository(employees: [_joao]);
    final controller = EmployeesListController(repo);
    await controller.load();
    expect(await controller.remove(_joao), isNull);
    expect(repo.removedId, 'e1');
    expect(repo.purgedId, isNull);
    expect(_listCalls(repo), 2);
  });

  test('purge chama a exclusão definitiva', () async {
    final repo = FakeEmployeesRepository(employees: [_joao]);
    final controller = EmployeesListController(repo);
    await controller.load();
    expect(await controller.purge(_joao), isNull);
    expect(repo.purgedId, 'e1');
    expect(repo.removedId, isNull);
  });

  test('ação com erro devolve a mensagem traduzida para o toast', () async {
    final repo = FakeEmployeesRepository(employees: [_joao]);
    final controller = EmployeesListController(repo);
    await controller.load();
    repo.failWith = const AppException(
      message: 'Employee not found',
      statusCode: 404,
      code: 'EMPLOYEE_NOT_FOUND',
    );
    expect(
      await controller.remove(_joao),
      startsWith('Funcionário não encontrado'),
    );
    repo.failWith = const AppException(
      message: 'Forbidden',
      statusCode: 403,
      code: 'FORBIDDEN_PERMISSION',
    );
    expect(await controller.purge(_joao), contains('não tem permissão'));
  });

  test('troca de tenant recarrega a partir da página 1', () async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    final tenants = TenantContext(LocalPreferences());
    await tenants.syncWith(
      const AuthUser(
        id: 'u1',
        name: 'Ana',
        email: 'ana@rag.local',
        profiles: <String>[],
        permissions: <String>{},
        tenants: <TenantRef>[
          TenantRef(id: 'a', name: 'A'),
          TenantRef(id: 'b', name: 'B'),
        ],
      ),
    );
    final repo = FakeEmployeesRepository(employees: [_joao], total: 45);
    final controller = EmployeesListController(repo, tenants: tenants);
    await controller.load();
    await controller.nextPage();
    expect(controller.page, 2);

    await tenants.select('b');
    await Future<void>.delayed(Duration.zero);
    expect(controller.page, 1);
    expect(repo.lastList?.page, 1);
    expect(_listCalls(repo), 3);
    controller.dispose();
  });
}
