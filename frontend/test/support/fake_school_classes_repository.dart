import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/modules/school_classes/data/models/school_class_input.dart';
import 'package:geduc_rag/modules/school_classes/data/models/school_class_model.dart';
import 'package:geduc_rag/modules/school_classes/data/school_classes_repository.dart';

/// Repositório fake de turmas: registra as chamadas e devolve dados fixos.
class FakeSchoolClassesRepository implements ISchoolClassesRepository {
  FakeSchoolClassesRepository({
    this.classes = const <SchoolClassModel>[],
    this.schools = const <SchoolOption>[],
    this.total,
    this.failWith,
  });

  List<SchoolClassModel> classes;
  List<SchoolOption> schools;
  int? total;
  AppException? failWith;

  final List<String> calls = <String>[];
  CreateSchoolClassInput? created;
  ({String id, UpdateSchoolClassInput input})? updated;
  String? removedId;
  SchoolClassQuery? lastQuery;
  bool? lastSchoolsActive;

  void _maybeFail() {
    final error = failWith;
    if (error != null) throw error;
  }

  @override
  Future<SchoolClassesPage> list([
    SchoolClassQuery query = const SchoolClassQuery(),
  ]) async {
    calls.add('list');
    lastQuery = query;
    _maybeFail();
    return SchoolClassesPage(items: classes, total: total ?? classes.length);
  }

  @override
  Future<SchoolClassModel> getById(String id) async {
    calls.add('getById');
    _maybeFail();
    return classes.firstWhere((c) => c.id == id);
  }

  @override
  Future<SchoolClassModel> create(CreateSchoolClassInput input) async {
    calls.add('create');
    _maybeFail();
    created = input;
    return SchoolClassModel(
      id: 'new',
      schoolId: input.schoolId,
      schoolYear: input.schoolYear,
      name: input.name,
    );
  }

  @override
  Future<SchoolClassModel> update(
    String id,
    UpdateSchoolClassInput input,
  ) async {
    calls.add('update');
    _maybeFail();
    updated = (id: id, input: input);
    return SchoolClassModel(
      id: id,
      schoolId: 's1',
      schoolYear: 2026,
      name: input.name ?? '',
    );
  }

  @override
  Future<void> remove(String id) async {
    calls.add('remove');
    _maybeFail();
    removedId = id;
  }

  @override
  Future<List<SchoolOption>> listSchoolOptions({bool? active}) async {
    calls.add('listSchoolOptions');
    lastSchoolsActive = active;
    _maybeFail();
    return schools;
  }
}
