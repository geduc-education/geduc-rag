import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/modules/school_classes/data/models/school_class_model.dart';
import 'package:geduc_rag/modules/school_classes/presentation/school_class_form_controller.dart';
import 'package:geduc_rag/modules/school_classes/presentation/school_classes_list_controller.dart';
import 'package:geduc_rag/shared/utils/list_filters.dart';

import '../support/fake_school_classes_repository.dart';

const _school = SchoolOption(id: 's1', name: 'EMEF');
const _class = SchoolClassModel(
  id: 'c1',
  schoolId: 's1',
  schoolName: 'EMEF',
  schoolYear: 2026,
  name: '8º A',
);

void main() {
  group('SchoolClassesListController', () {
    test('bootstrap carrega escolas do filtro e a lista', () async {
      final repo = FakeSchoolClassesRepository(
        classes: [_class],
        schools: [_school],
      );
      final controller = SchoolClassesListController(repo);
      await controller.bootstrap();
      expect(controller.schools.single.id, 's1');
      expect(repo.lastSchoolsActive, isNull);
      expect(controller.state, ListViewState.ready);
    });

    test('filtro de escola e status voltam à página 1', () async {
      final repo = FakeSchoolClassesRepository(classes: [_class], total: 45);
      final controller = SchoolClassesListController(repo);
      await controller.load();
      await controller.nextPage();
      expect(controller.page, 2);

      await controller.setSchool('s1');
      expect(repo.lastQuery?.page, 1);
      expect(repo.lastQuery?.schoolId, 's1');

      await controller.setFilter(ActiveFilter.active);
      expect(repo.lastQuery?.active, isTrue);

      await controller.setSchool(null);
      expect(repo.lastQuery?.schoolId, isNull);
    });

    test('remove exclui e erro vira mensagem amigável', () async {
      final repo = FakeSchoolClassesRepository(classes: [_class]);
      final controller = SchoolClassesListController(repo);
      await controller.load();
      expect(await controller.remove(_class), isNull);
      expect(repo.removedId, 'c1');

      repo.failWith = const AppException(
        message: 'x',
        statusCode: 404,
        code: 'SCHOOL_CLASS_NOT_FOUND',
      );
      expect(await controller.remove(_class), contains('Turma não'));
    });
  });

  group('SchoolClassFormController', () {
    test('criação carrega escolas ativas e envia escola/ano', () async {
      final repo = FakeSchoolClassesRepository(schools: [_school]);
      final controller = SchoolClassFormController(repo);
      await controller.bootstrap();
      expect(repo.lastSchoolsActive, isTrue);
      controller.selectSchool('s1');
      expect(await controller.save(name: '8º A', schoolYear: 2026), isTrue);
      expect(repo.created?.toJson(), {
        'schoolId': 's1',
        'schoolYear': 2026,
        'name': '8º A',
        'active': true,
      });
    });

    test('criação sem escola falha sem chamar a API', () async {
      final repo = FakeSchoolClassesRepository();
      final controller = SchoolClassFormController(repo);
      expect(await controller.save(name: 'A', schoolYear: 2026), isFalse);
      expect(controller.error, 'Selecione a escola da turma.');
      expect(repo.calls, isNot(contains('create')));
    });

    test('edição não carrega escolas e só envia nome/status', () async {
      final repo = FakeSchoolClassesRepository();
      final controller = SchoolClassFormController(repo, editing: _class)
        ..setActive(false);
      await controller.bootstrap();
      expect(repo.calls, isEmpty);
      expect(await controller.save(name: '8º B', schoolYear: 1999), isTrue);
      expect(repo.updated?.id, 'c1');
      expect(repo.updated?.input.toJson(), {'name': '8º B', 'active': false});
    });

    test('nome duplicado vira erro amigável', () async {
      final repo = FakeSchoolClassesRepository(
        failWith: const AppException(
          message: 'dup',
          statusCode: 409,
          code: 'SCHOOL_CLASS_NAME_TAKEN',
        ),
      );
      final controller = SchoolClassFormController(repo, editing: _class);
      expect(await controller.save(name: '8º A', schoolYear: 2026), isFalse);
      expect(controller.error, contains('Já existe uma turma'));
    });
  });
}
