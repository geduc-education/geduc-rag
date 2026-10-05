import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/modules/schools/data/models/lesson_slot.dart';
import 'package:geduc_rag/modules/schools/presentation/lesson_slots_controller.dart';
import 'package:geduc_rag/shared/utils/list_filters.dart';
import 'package:geduc_rag/shared/utils/time_text.dart';

import '../support/fake_lesson_slots_repository.dart';

const LessonSlot _first = LessonSlot(
  id: 'a',
  schoolId: 'e1',
  name: '1ª aula',
  startTime: '07:00',
  endTime: '07:50',
  position: 1,
);

const LessonSlotInput _input = LessonSlotInput(
  name: ' 2ª aula ',
  startTime: '07:50',
  endTime: '08:40',
);

AppException _error(String code, int status) =>
    AppException(message: 'x', statusCode: status, code: code);

void main() {
  group('LessonSlot', () {
    test('fromJson lê o DTO e formata o intervalo', () {
      final slot = LessonSlot.fromJson(const <String, dynamic>{
        'id': 'a',
        'schoolId': 'e1',
        'name': '1ª aula',
        'startTime': '07:00',
        'endTime': '07:50',
        'position': 2,
      });
      expect(slot.id, 'a');
      expect(slot.schoolId, 'e1');
      expect(slot.position, 2);
      expect(slot.timeRange, '07:00–07:50');
    });

    test('listFromJson preserva a ordem da API e ignora lixo', () {
      final slots = LessonSlot.listFromJson(const <String, dynamic>{
        'data': <Object>[
          {'id': 'b', 'name': '2ª aula'},
          'lixo',
          {'id': 'a', 'name': '1ª aula'},
        ],
      });
      expect(slots.map((s) => s.id), <String>['b', 'a']);
      expect(LessonSlot.listFromJson(const <String, dynamic>{}), isEmpty);
    });

    test('input apara campos e só envia position quando informado', () {
      expect(_input.toJson(), <String, dynamic>{
        'name': '2ª aula',
        'startTime': '07:50',
        'endTime': '08:40',
      });
      expect(
        const LessonSlotInput(
          name: 'A',
          startTime: '07:00',
          endTime: '07:50',
          position: 3,
        ).toJson()['position'],
        3,
      );
    });

    test('HH:mm válido como o backend', () {
      expect(isValidTimeText('07:00'), isTrue);
      expect(isValidTimeText('23:59'), isTrue);
      expect(isValidTimeText('24:00'), isFalse);
      expect(isValidTimeText('7:00'), isFalse);
    });
  });

  group('LessonSlotsController', () {
    test('carrega; lista vazia vira empty', () async {
      final repo = FakeLessonSlotsRepository();
      final c = LessonSlotsController(repo, schoolId: 'e1');
      await c.load();
      expect(c.state, ListViewState.empty);

      repo.slots = <LessonSlot>[_first];
      await c.load();
      expect(c.state, ListViewState.ready);
      expect(c.slots.single.name, '1ª aula');
    });

    test('cria e edita na escola e recarrega', () async {
      final repo = FakeLessonSlotsRepository(slots: <LessonSlot>[_first]);
      final c = LessonSlotsController(repo, schoolId: 'e1');
      await c.load();
      expect(await c.save(_input), isNull);
      expect(repo.created?.schoolId, 'e1');
      expect(c.slots, hasLength(2));

      expect(await c.save(_input, editing: _first), isNull);
      expect(repo.updated?.id, 'a');
      expect(c.slots.first.startTime, '07:50');
      expect(repo.calls.where((x) => x == 'list'), hasLength(3));
    });

    test('erros do backend viram mensagens amigáveis', () async {
      final repo = FakeLessonSlotsRepository(slots: <LessonSlot>[_first]);
      final c = LessonSlotsController(repo, schoolId: 'e1');
      await c.load();
      repo.failWith = _error('LESSON_SLOT_OVERLAP', 409);
      expect(await c.save(_input), contains('sobrepõe'));
      repo.failWith = _error('LESSON_SLOT_NAME_TAKEN', 409);
      expect(await c.save(_input), contains('Já existe um horário'));
      repo.failWith = _error('LESSON_SLOT_INVALID_RANGE', 400);
      expect(await c.save(_input), contains('depois do início'));
      repo.failWith = _error('LESSON_SLOT_IN_USE', 409);
      expect(await c.remove(_first), contains('não pode ser excluído'));
      expect(c.slots, hasLength(1));
    });

    test('exclui e recarrega; falha na carga vira error', () async {
      final repo = FakeLessonSlotsRepository(slots: <LessonSlot>[_first]);
      final c = LessonSlotsController(repo, schoolId: 'e1');
      await c.load();
      expect(await c.remove(_first), isNull);
      expect(repo.removed, (schoolId: 'e1', id: 'a'));
      expect(c.state, ListViewState.empty);

      repo.failWith = _error('TENANT_OUT_OF_SCOPE', 403);
      await c.load();
      expect(c.state, ListViewState.error);
      expect(c.error, contains('tenant selecionado'));
    });
  });
}
