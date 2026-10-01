import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/modules/employees/data/employees_repository.dart';
import 'package:geduc_rag/modules/employees/data/models/employee_input.dart';
import 'package:geduc_rag/modules/employees/data/models/employee_model.dart';

/// Repositório fake de funcionários: registra as chamadas e devolve dados
/// fixos.
class FakeEmployeesRepository implements IEmployeesRepository {
  FakeEmployeesRepository({
    this.employees = const <EmployeeModel>[],
    this.total,
    this.users = const <LinkableUser>[],
    this.failWith,
  });

  List<EmployeeModel> employees;
  int? total;
  List<LinkableUser> users;
  AppException? failWith;

  final List<String> calls = <String>[];
  CreateEmployeeInput? created;
  UpdateEmployeeInput? updated;
  String? removedId;
  String? purgedId;
  String? usersTenantId;
  ({int page, String? search, bool? active})? lastList;

  void _maybeFail() {
    final error = failWith;
    if (error != null) throw error;
  }

  @override
  Future<EmployeesPage> list({
    int page = 1,
    int limit = 20,
    String? search,
    bool? active,
  }) async {
    calls.add('list');
    lastList = (page: page, search: search, active: active);
    _maybeFail();
    return EmployeesPage(items: employees, total: total ?? employees.length);
  }

  @override
  Future<EmployeeModel> getById(String id) async {
    calls.add('getById');
    _maybeFail();
    return employees.firstWhere((e) => e.id == id);
  }

  @override
  Future<EmployeeModel> create(CreateEmployeeInput input) async {
    calls.add('create');
    _maybeFail();
    created = input;
    return EmployeeModel(
      id: 'new',
      name: input.name,
      email: input.email,
      document: input.document,
    );
  }

  @override
  Future<EmployeeModel> update(String id, UpdateEmployeeInput input) async {
    calls.add('update');
    _maybeFail();
    updated = input;
    return employees.firstWhere((e) => e.id == id);
  }

  @override
  Future<void> remove(String id) async {
    calls.add('remove');
    _maybeFail();
    removedId = id;
  }

  @override
  Future<void> purge(String id) async {
    calls.add('purge');
    _maybeFail();
    purgedId = id;
  }

  @override
  Future<List<LinkableUser>> listLinkableUsers(String tenantId) async {
    calls.add('listLinkableUsers');
    usersTenantId = tenantId;
    _maybeFail();
    return users;
  }
}
