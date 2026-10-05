import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/modules/schools/data/models/school_model.dart';
import 'package:geduc_rag/modules/schools/presentation/school_form_controller.dart';
import 'package:geduc_rag/modules/schools/presentation/schools_list_controller.dart';
import 'package:geduc_rag/shared/utils/list_filters.dart';

import '../support/fake_schools_repository.dart';

const _lobato = SchoolModel(id: 's1', name: 'EMEF Monteiro Lobato');

void main() {
  group('SchoolsListController', () {
    test('carrega e vai para ready; lista vazia vira empty', () async {
      final repo = FakeSchoolsRepository(schools: [_lobato]);
      final controller = SchoolsListController(repo);
      await controller.load();
      expect(controller.state, ListViewState.ready);
      expect(controller.schools.single.id, 's1');

      repo.schools = const [];
      await controller.load();
      expect(controller.state, ListViewState.empty);
    });

    test('busca e filtro voltam à página 1 e vão na query', () async {
      final repo = FakeSchoolsRepository(schools: [_lobato], total: 45);
      final controller = SchoolsListController(repo);
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
      final repo = FakeSchoolsRepository(
        failWith: const AppException(
          message: 'x',
          statusCode: 403,
          code: 'TENANT_OUT_OF_SCOPE',
        ),
      );
      final controller = SchoolsListController(repo);
      await controller.load();
      expect(controller.state, ListViewState.error);
      expect(controller.error, contains('tenant selecionado'));
    });

    test('remove exclui e recarrega; erro vira mensagem do toast', () async {
      final repo = FakeSchoolsRepository(schools: [_lobato]);
      final controller = SchoolsListController(repo);
      await controller.load();
      expect(await controller.remove(_lobato), isNull);
      expect(repo.removedId, 's1');
      expect(repo.calls.where((c) => c == 'list'), hasLength(2));

      repo.failWith = const AppException(
        message: 'x',
        statusCode: 404,
        code: 'SCHOOL_NOT_FOUND',
      );
      expect(await controller.remove(_lobato), contains('não encontrada'));
    });
  });

  group('SchoolFormController', () {
    test('criação envia nome e status', () async {
      final repo = FakeSchoolsRepository();
      final controller = SchoolFormController(repo)..setActive(false);
      expect(await controller.save(name: ' EMEF '), isTrue);
      expect(repo.created?.toJson(), {'name': 'EMEF', 'active': false});
      // Após criar, passa a editar a escola criada (libera os horários).
      expect(controller.isEditing, isTrue);
      expect(controller.editing?.id, 'new');
    });

    test('edição faz update no id da escola', () async {
      final repo = FakeSchoolsRepository();
      final controller = SchoolFormController(repo, editing: _lobato);
      expect(controller.isEditing, isTrue);
      expect(await controller.save(name: 'Novo'), isTrue);
      expect(repo.updated?.id, 's1');
      expect(repo.updated?.input.name, 'Novo');
    });

    test('nome duplicado vira erro amigável no banner', () async {
      final repo = FakeSchoolsRepository(
        failWith: const AppException(
          message: 'dup',
          statusCode: 409,
          code: 'SCHOOL_NAME_TAKEN',
        ),
      );
      final controller = SchoolFormController(repo);
      expect(await controller.save(name: 'EMEF'), isFalse);
      expect(controller.error, contains('Já existe uma escola'));
      expect(controller.saving, isFalse);
    });
  });
}
