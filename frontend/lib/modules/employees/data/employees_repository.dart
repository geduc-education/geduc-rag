import '../../../core/http/api_client.dart';
import 'models/employee_input.dart';
import 'models/employee_model.dart';

/// Contrato do repositório de funcionários. Todas as rotas são escopadas pelo
/// tenant ativo — o header `tenant-id` é injetado pelo [ApiClient].
abstract interface class IEmployeesRepository {
  /// `GET /employees`. [active] `null` = sem filtro de status.
  Future<EmployeesPage> list({
    int page = 1,
    int limit = 20,
    String? search,
    bool? active,
  });
  Future<EmployeeModel> getById(String id);
  Future<EmployeeModel> create(CreateEmployeeInput input);
  Future<EmployeeModel> update(String id, UpdateEmployeeInput input);

  /// Exclusão lógica (`DELETE /employees/:id`).
  Future<void> remove(String id);

  /// Exclusão DEFINITIVA (`DELETE /employees/:id/permanent`) — irreversível.
  Future<void> purge(String id);

  /// Opções do seletor de usuário vinculado: usuários do [tenantId]
  /// (`GET /users?tenantId=&limit=100`).
  Future<List<LinkableUser>> listLinkableUsers(String tenantId);
}

class EmployeesRepository implements IEmployeesRepository {
  EmployeesRepository(this._client);

  final ApiClient _client;

  /// Limite máximo aceito pelas listagens do backend.
  static const int maxLimit = 100;

  @override
  Future<EmployeesPage> list({
    int page = 1,
    int limit = 20,
    String? search,
    bool? active,
  }) async {
    final term = search?.trim() ?? '';
    final response = await _client.get<Map<String, dynamic>>(
      '/employees',
      queryParameters: <String, dynamic>{
        'page': page,
        'limit': limit > maxLimit ? maxLimit : limit,
        if (term.isNotEmpty) 'search': term,
        if (active != null) 'active': active.toString(),
      },
    );
    return EmployeesPage.fromJson(response.data ?? const <String, dynamic>{});
  }

  @override
  Future<EmployeeModel> getById(String id) async {
    final response = await _client.get<Map<String, dynamic>>('/employees/$id');
    return _employee(response.data);
  }

  @override
  Future<EmployeeModel> create(CreateEmployeeInput input) async {
    final response = await _client.post<Map<String, dynamic>>(
      '/employees',
      data: input.toJson(),
    );
    return _employee(response.data);
  }

  @override
  Future<EmployeeModel> update(String id, UpdateEmployeeInput input) async {
    final response = await _client.patch<Map<String, dynamic>>(
      '/employees/$id',
      data: input.toJson(),
    );
    return _employee(response.data);
  }

  @override
  Future<void> remove(String id) => _client.delete<void>('/employees/$id');

  @override
  Future<void> purge(String id) =>
      _client.delete<void>('/employees/$id/permanent');

  @override
  Future<List<LinkableUser>> listLinkableUsers(String tenantId) async {
    final response = await _client.get<Map<String, dynamic>>(
      '/users',
      queryParameters: <String, dynamic>{
        'tenantId': tenantId,
        'limit': maxLimit,
      },
    );
    return LinkableUser.listFromPage(
      response.data ?? const <String, dynamic>{},
    );
  }

  EmployeeModel _employee(Map<String, dynamic>? data) =>
      EmployeeModel.fromJson(data ?? const <String, dynamic>{});
}
