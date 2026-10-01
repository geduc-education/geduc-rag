import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/modules/employees/data/models/employee_model.dart';
import 'package:geduc_rag/modules/employees/presentation/employee_form_controller.dart';

import '../support/fake_employees_repository.dart';

const _ana = LinkableUser(id: 'u1', name: 'Ana', email: 'ana@rag.local');
const _editing = EmployeeModel(
  id: 'e1',
  name: 'João',
  email: 'joao@escola.com',
  document: '12345678909',
  position: 'Professor',
  userId: 'u1',
);

void main() {
  test('sem permissão de usuário não carrega o seletor', () async {
    final repo = FakeEmployeesRepository(users: [_ana]);
    final controller = EmployeeFormController(repo, tenantId: 't1');
    await controller.bootstrap();
    expect(repo.calls, isEmpty);
    expect(controller.users, isEmpty);
  });

  test('com permissão carrega os usuários do tenant ativo', () async {
    final repo = FakeEmployeesRepository(users: [_ana]);
    final controller = EmployeeFormController(
      repo,
      canLinkUser: true,
      tenantId: 't1',
    );
    await controller.bootstrap();
    expect(repo.usersTenantId, 't1');
    expect(controller.users.single.id, 'u1');
    expect(controller.loadingUsers, isFalse);
  });

  test('falha ao carregar usuários não bloqueia o formulário', () async {
    final repo = FakeEmployeesRepository(
      failWith: const AppException(message: 'x', statusCode: 500),
    );
    final controller = EmployeeFormController(
      repo,
      canLinkUser: true,
      tenantId: 't1',
    );
    await controller.bootstrap();
    expect(controller.usersError, isNotNull);
    expect(controller.error, isNull);
  });

  test('criação envia CPF só com dígitos, usuário e status', () async {
    final repo = FakeEmployeesRepository(users: [_ana]);
    final controller = EmployeeFormController(
      repo,
      canLinkUser: true,
      tenantId: 't1',
    );
    await controller.bootstrap();
    controller
      ..selectUser('u1')
      ..setActive(false);
    final ok = await controller.save(
      name: ' João ',
      email: 'joao@escola.com',
      document: '123.456.789-09',
      position: '',
    );
    expect(ok, isTrue);
    expect(repo.created!.toJson(), <String, dynamic>{
      'name': 'João',
      'email': 'joao@escola.com',
      'document': '12345678909',
      'userId': 'u1',
      'active': false,
    });
  });

  test('edição limpa usuário vinculado e cargo enviando null', () async {
    final repo = FakeEmployeesRepository(employees: [_editing], users: [_ana]);
    final controller = EmployeeFormController(
      repo,
      editing: _editing,
      canLinkUser: true,
      tenantId: 't1',
    );
    await controller.bootstrap();
    expect(controller.selectedUserId, 'u1');
    controller.selectUser('');
    await controller.save(
      name: 'João',
      email: 'joao@escola.com',
      document: '123.456.789-09',
      position: ' ',
    );
    final body = repo.updated!.toJson();
    expect(body['userId'], isNull);
    expect(body.containsKey('userId'), isTrue);
    expect(body['position'], isNull);
    expect(body.containsKey('position'), isTrue);
  });

  test('edição sem permissão de usuário não mexe no vínculo', () async {
    final repo = FakeEmployeesRepository(employees: [_editing]);
    final controller = EmployeeFormController(repo, editing: _editing);
    await controller.save(
      name: 'João',
      email: 'joao@escola.com',
      document: '12345678909',
      position: 'Coordenador',
    );
    final body = repo.updated!.toJson();
    expect(body.containsKey('userId'), isFalse);
    expect(body['position'], 'Coordenador');
  });

  test('vínculo atual fora da lista é sinalizado', () async {
    final repo = FakeEmployeesRepository(users: const []);
    final controller = EmployeeFormController(
      repo,
      editing: _editing,
      canLinkUser: true,
      tenantId: 't1',
    );
    await controller.bootstrap();
    expect(controller.linkedUserMissing, isTrue);
  });

  test('409 de CPF duplicado vira mensagem amigável no formulário', () async {
    final repo = FakeEmployeesRepository(
      failWith: const AppException(
        message: 'Document taken',
        statusCode: 409,
        code: 'EMPLOYEE_DOCUMENT_TAKEN',
      ),
    );
    final controller = EmployeeFormController(repo);
    final ok = await controller.save(
      name: 'João',
      email: 'joao@escola.com',
      document: '12345678909',
    );
    expect(ok, isFalse);
    expect(controller.error, 'Já existe um funcionário com este CPF.');
    expect(controller.saving, isFalse);
  });

  test('400 de usuário não vinculável tem mensagem própria', () async {
    final repo = FakeEmployeesRepository(
      failWith: const AppException(
        message: 'User not linkable',
        statusCode: 400,
        code: 'EMPLOYEE_USER_NOT_LINKABLE',
      ),
    );
    final controller = EmployeeFormController(repo);
    await controller.save(
      name: 'João',
      email: 'joao@escola.com',
      document: '12345678909',
    );
    expect(controller.error, contains('não tem vínculo com este tenant'));
  });
}
