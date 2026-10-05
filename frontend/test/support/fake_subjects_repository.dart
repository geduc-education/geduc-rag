import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/modules/subjects/data/models/subject_input.dart';
import 'package:geduc_rag/modules/subjects/data/models/subject_model.dart';
import 'package:geduc_rag/modules/subjects/data/subjects_repository.dart';

/// Repositório fake de disciplinas: registra as chamadas e devolve dados fixos.
class FakeSubjectsRepository implements ISubjectsRepository {
  FakeSubjectsRepository({
    this.subjects = const <SubjectModel>[],
    this.total,
    this.failWith,
  });

  List<SubjectModel> subjects;
  int? total;
  AppException? failWith;

  final List<String> calls = <String>[];
  SubjectInput? created;
  ({String id, SubjectInput input})? updated;
  String? removedId;
  ({int page, String? search, bool? active})? lastList;

  void _maybeFail() {
    final error = failWith;
    if (error != null) throw error;
  }

  @override
  Future<SubjectsPage> list({
    int page = 1,
    int limit = 20,
    String? search,
    bool? active,
  }) async {
    calls.add('list');
    lastList = (page: page, search: search, active: active);
    _maybeFail();
    return SubjectsPage(items: subjects, total: total ?? subjects.length);
  }

  @override
  Future<SubjectModel> getById(String id) async {
    calls.add('getById');
    _maybeFail();
    return subjects.firstWhere((s) => s.id == id);
  }

  @override
  Future<SubjectModel> create(SubjectInput input) async {
    calls.add('create');
    _maybeFail();
    created = input;
    return SubjectModel(id: 'new', name: input.name, active: input.active);
  }

  @override
  Future<SubjectModel> update(String id, SubjectInput input) async {
    calls.add('update');
    _maybeFail();
    updated = (id: id, input: input);
    return SubjectModel(id: id, name: input.name, active: input.active);
  }

  @override
  Future<void> remove(String id) async {
    calls.add('remove');
    _maybeFail();
    removedId = id;
  }
}
