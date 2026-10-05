import '../../../core/http/api_client.dart';
import 'models/school_class_input.dart';
import 'models/school_class_model.dart';

/// Filtros da listagem de turmas (`GET /school-classes`). `null` = sem filtro.
class SchoolClassQuery {
  const SchoolClassQuery({
    this.page = 1,
    this.limit = 20,
    this.search,
    this.active,
    this.schoolId,
    this.schoolYear,
  });

  final int page;
  final int limit;
  final String? search;
  final bool? active;
  final String? schoolId;
  final int? schoolYear;
}

/// Contrato do repositório de turmas. Todas as rotas são escopadas pelo
/// tenant ativo — o header `tenant-id` é injetado pelo [ApiClient].
abstract interface class ISchoolClassesRepository {
  Future<SchoolClassesPage> list([SchoolClassQuery query]);
  Future<SchoolClassModel> getById(String id);
  Future<SchoolClassModel> create(CreateSchoolClassInput input);
  Future<SchoolClassModel> update(String id, UpdateSchoolClassInput input);

  /// Exclusão lógica (`DELETE /school-classes/:id`).
  Future<void> remove(String id);

  /// Opções de escola (`GET /schools?limit=100`); [active] filtra o status.
  Future<List<SchoolOption>> listSchoolOptions({bool? active});
}

class SchoolClassesRepository implements ISchoolClassesRepository {
  SchoolClassesRepository(this._client);

  final ApiClient _client;

  /// Limite máximo aceito pelas listagens do backend.
  static const int maxLimit = 100;

  static const String _path = '/school-classes';

  @override
  Future<SchoolClassesPage> list([
    SchoolClassQuery query = const SchoolClassQuery(),
  ]) async {
    final term = query.search?.trim() ?? '';
    final schoolId = query.schoolId;
    final response = await _client.get<Map<String, dynamic>>(
      _path,
      queryParameters: <String, dynamic>{
        'page': query.page,
        'limit': query.limit > maxLimit ? maxLimit : query.limit,
        if (term.isNotEmpty) 'search': term,
        if (query.active != null) 'active': query.active.toString(),
        if (schoolId != null && schoolId.isNotEmpty) 'schoolId': schoolId,
        'schoolYear': ?query.schoolYear,
      },
    );
    return SchoolClassesPage.fromJson(
      response.data ?? const <String, dynamic>{},
    );
  }

  @override
  Future<SchoolClassModel> getById(String id) async {
    final response = await _client.get<Map<String, dynamic>>('$_path/$id');
    return _schoolClass(response.data);
  }

  @override
  Future<SchoolClassModel> create(CreateSchoolClassInput input) async {
    final response = await _client.post<Map<String, dynamic>>(
      _path,
      data: input.toJson(),
    );
    return _schoolClass(response.data);
  }

  @override
  Future<SchoolClassModel> update(
    String id,
    UpdateSchoolClassInput input,
  ) async {
    final response = await _client.patch<Map<String, dynamic>>(
      '$_path/$id',
      data: input.toJson(),
    );
    return _schoolClass(response.data);
  }

  @override
  Future<void> remove(String id) => _client.delete<void>('$_path/$id');

  @override
  Future<List<SchoolOption>> listSchoolOptions({bool? active}) async {
    final response = await _client.get<Map<String, dynamic>>(
      '/schools',
      queryParameters: <String, dynamic>{
        'limit': maxLimit,
        if (active != null) 'active': active.toString(),
      },
    );
    return SchoolOption.listFromPage(
      response.data ?? const <String, dynamic>{},
    );
  }

  SchoolClassModel _schoolClass(Map<String, dynamic>? data) =>
      SchoolClassModel.fromJson(data ?? const <String, dynamic>{});
}
