import '../../../core/http/api_client.dart';
import 'models/school_input.dart';
import 'models/school_model.dart';

/// Contrato do repositório de escolas. Todas as rotas são escopadas pelo
/// tenant ativo — o header `tenant-id` é injetado pelo [ApiClient].
abstract interface class ISchoolsRepository {
  /// `GET /schools`. [active] `null` = sem filtro de status.
  Future<SchoolsPage> list({
    int page = 1,
    int limit = 20,
    String? search,
    bool? active,
  });
  Future<SchoolModel> getById(String id);
  Future<SchoolModel> create(SchoolInput input);
  Future<SchoolModel> update(String id, SchoolInput input);

  /// Exclusão lógica (`DELETE /schools/:id`).
  Future<void> remove(String id);
}

class SchoolsRepository implements ISchoolsRepository {
  SchoolsRepository(this._client);

  final ApiClient _client;

  /// Limite máximo aceito pelas listagens do backend.
  static const int maxLimit = 100;

  static const String _path = '/schools';

  @override
  Future<SchoolsPage> list({
    int page = 1,
    int limit = 20,
    String? search,
    bool? active,
  }) async {
    final term = search?.trim() ?? '';
    final response = await _client.get<Map<String, dynamic>>(
      _path,
      queryParameters: <String, dynamic>{
        'page': page,
        'limit': limit > maxLimit ? maxLimit : limit,
        if (term.isNotEmpty) 'search': term,
        if (active != null) 'active': active.toString(),
      },
    );
    return SchoolsPage.fromJson(response.data ?? const <String, dynamic>{});
  }

  @override
  Future<SchoolModel> getById(String id) async {
    final response = await _client.get<Map<String, dynamic>>('$_path/$id');
    return _school(response.data);
  }

  @override
  Future<SchoolModel> create(SchoolInput input) async {
    final response = await _client.post<Map<String, dynamic>>(
      _path,
      data: input.toJson(),
    );
    return _school(response.data);
  }

  @override
  Future<SchoolModel> update(String id, SchoolInput input) async {
    final response = await _client.patch<Map<String, dynamic>>(
      '$_path/$id',
      data: input.toJson(),
    );
    return _school(response.data);
  }

  @override
  Future<void> remove(String id) => _client.delete<void>('$_path/$id');

  SchoolModel _school(Map<String, dynamic>? data) =>
      SchoolModel.fromJson(data ?? const <String, dynamic>{});
}
