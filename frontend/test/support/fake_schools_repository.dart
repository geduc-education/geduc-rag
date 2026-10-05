import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/modules/schools/data/models/school_input.dart';
import 'package:geduc_rag/modules/schools/data/models/school_model.dart';
import 'package:geduc_rag/modules/schools/data/schools_repository.dart';

/// Repositório fake de escolas: registra as chamadas e devolve dados fixos.
class FakeSchoolsRepository implements ISchoolsRepository {
  FakeSchoolsRepository({
    this.schools = const <SchoolModel>[],
    this.total,
    this.failWith,
  });

  List<SchoolModel> schools;
  int? total;
  AppException? failWith;

  final List<String> calls = <String>[];
  SchoolInput? created;
  ({String id, SchoolInput input})? updated;
  String? removedId;
  ({int page, String? search, bool? active})? lastList;

  void _maybeFail() {
    final error = failWith;
    if (error != null) throw error;
  }

  @override
  Future<SchoolsPage> list({
    int page = 1,
    int limit = 20,
    String? search,
    bool? active,
  }) async {
    calls.add('list');
    lastList = (page: page, search: search, active: active);
    _maybeFail();
    return SchoolsPage(items: schools, total: total ?? schools.length);
  }

  @override
  Future<SchoolModel> getById(String id) async {
    calls.add('getById');
    _maybeFail();
    return schools.firstWhere((s) => s.id == id);
  }

  @override
  Future<SchoolModel> create(SchoolInput input) async {
    calls.add('create');
    _maybeFail();
    created = input;
    return SchoolModel(id: 'new', name: input.name, active: input.active);
  }

  @override
  Future<SchoolModel> update(String id, SchoolInput input) async {
    calls.add('update');
    _maybeFail();
    updated = (id: id, input: input);
    return SchoolModel(id: id, name: input.name, active: input.active);
  }

  @override
  Future<void> remove(String id) async {
    calls.add('remove');
    _maybeFail();
    removedId = id;
  }
}
