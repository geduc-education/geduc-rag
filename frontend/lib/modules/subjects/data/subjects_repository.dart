import '../../../core/http/api_client.dart';
import 'models/subject_input.dart';
import 'models/subject_model.dart';

/// Contrato do repositório de disciplinas. Todas as rotas são escopadas pelo
/// tenant ativo — o header `tenant-id` é injetado pelo [ApiClient].
abstract interface class ISubjectsRepository {
  /// `GET /subjects`. [active] `null` = sem filtro de status.
  Future<SubjectsPage> list({
    int page = 1,
    int limit = 20,
    String? search,
    bool? active,
  });
  Future<SubjectModel> getById(String id);
  Future<SubjectModel> create(SubjectInput input);
  Future<SubjectModel> update(String id, SubjectInput input);

  /// Exclusão lógica (`DELETE /subjects/:id`).
  Future<void> remove(String id);
}

class SubjectsRepository implements ISubjectsRepository {
  SubjectsRepository(this._client);

  final ApiClient _client;

  /// Limite máximo aceito pelas listagens do backend.
  static const int maxLimit = 100;

  static const String _path = '/subjects';

  @override
  Future<SubjectsPage> list({
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
    return SubjectsPage.fromJson(response.data ?? const <String, dynamic>{});
  }

  @override
  Future<SubjectModel> getById(String id) async {
    final response = await _client.get<Map<String, dynamic>>('$_path/$id');
    return _subject(response.data);
  }

  @override
  Future<SubjectModel> create(SubjectInput input) async {
    final response = await _client.post<Map<String, dynamic>>(
      _path,
      data: input.toJson(),
    );
    return _subject(response.data);
  }

  @override
  Future<SubjectModel> update(String id, SubjectInput input) async {
    final response = await _client.patch<Map<String, dynamic>>(
      '$_path/$id',
      data: input.toJson(),
    );
    return _subject(response.data);
  }

  @override
  Future<void> remove(String id) => _client.delete<void>('$_path/$id');

  SubjectModel _subject(Map<String, dynamic>? data) =>
      SubjectModel.fromJson(data ?? const <String, dynamic>{});
}
