import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/modules/subjects/data/models/subject_model.dart';
import 'package:geduc_rag/modules/subjects/presentation/subject_form_controller.dart';
import 'package:geduc_rag/modules/subjects/presentation/subjects_list_controller.dart';
import 'package:geduc_rag/shared/utils/list_filters.dart';

import '../support/fake_subjects_repository.dart';

const _lobato = SubjectModel(id: 's1', name: 'Matemática');

void main() {
  group('SubjectsListController', () {
    test('carrega e vai para ready; lista vazia vira empty', () async {
      final repo = FakeSubjectsRepository(subjects: [_lobato]);
      final controller = SubjectsListController(repo);
      await controller.load();
      expect(controller.state, ListViewState.ready);
      expect(controller.subjects.single.id, 's1');

      repo.subjects = const [];
      await controller.load();
      expect(controller.state, ListViewState.empty);
    });

    test('busca e filtro voltam à página 1 e vão na query', () async {
      final repo = FakeSubjectsRepository(subjects: [_lobato], total: 45);
      final controller = SubjectsListController(repo);
      await controller.load();
      expect(controller.pageCount, 3);
      await controller.nextPage();
      expect(controller.page, 2);

      await controller.setFilter(ActiveFilter.inactive);
      expect(repo.lastList, (page: 1, search: '', active: false));

      await controller.search('lobato');
      expect(repo.lastList, (page: 1, search: 'lobato', active: false));
    });

    test('erro de tenant vira mensagem amigável', () async {
      final repo = FakeSubjectsRepository(
        failWith: const AppException(
          message: 'x',
          statusCode: 403,
          code: 'TENANT_OUT_OF_SCOPE',
        ),
      );
      final controller = SubjectsListController(repo);
      await controller.load();
      expect(controller.state, ListViewState.error);
      expect(controller.error, contains('tenant selecionado'));
    });

    test('remove exclui e recarrega; erro vira mensagem do toast', () async {
      final repo = FakeSubjectsRepository(subjects: [_lobato]);
      final controller = SubjectsListController(repo);
      await controller.load();
      expect(await controller.remove(_lobato), isNull);
      expect(repo.removedId, 's1');
      expect(repo.calls.where((c) => c == 'list'), hasLength(2));

      repo.failWith = const AppException(
        message: 'x',
        statusCode: 404,
        code: 'SUBJECT_NOT_FOUND',
      );
      expect(await controller.remove(_lobato), contains('não encontrada'));
    });
  });

  group('SubjectFormController', () {
    test('criação envia nome e status', () async {
      final repo = FakeSubjectsRepository();
      final controller = SubjectFormController(repo)..setActive(false);
      expect(await controller.save(name: ' Mat '), isTrue);
      expect(repo.created?.toJson(), {'name': 'Mat', 'active': false});
    });

    test('edição faz update no id da disciplina', () async {
      final repo = FakeSubjectsRepository();
      final controller = SubjectFormController(repo, editing: _lobato);
      expect(controller.isEditing, isTrue);
      expect(await controller.save(name: 'Novo'), isTrue);
      expect(repo.updated?.id, 's1');
      expect(repo.updated?.input.name, 'Novo');
    });

    test('nome duplicado vira erro amigável no banner', () async {
      final repo = FakeSubjectsRepository(
        failWith: const AppException(
          message: 'dup',
          statusCode: 409,
          code: 'SUBJECT_NAME_TAKEN',
        ),
      );
      final controller = SubjectFormController(repo);
      expect(await controller.save(name: 'Mat'), isFalse);
      expect(controller.error, contains('Já existe uma disciplina'));
      expect(controller.saving, isFalse);
    });
  });
}
