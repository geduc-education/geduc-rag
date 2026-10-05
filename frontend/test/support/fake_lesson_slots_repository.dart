import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/modules/schools/data/lesson_slots_repository.dart';
import 'package:geduc_rag/modules/schools/data/models/lesson_slot.dart';

/// Repositório fake dos horários de aula: registra as chamadas e mantém a
/// lista em memória (create anexa; update troca; remove tira).
class FakeLessonSlotsRepository implements ILessonSlotsRepository {
  FakeLessonSlotsRepository({List<LessonSlot> slots = const <LessonSlot>[]})
    : slots = <LessonSlot>[...slots];

  List<LessonSlot> slots;
  AppException? failWith;

  final List<String> calls = <String>[];
  ({String schoolId, LessonSlotInput input})? created;
  ({String schoolId, String id, LessonSlotInput input})? updated;
  ({String schoolId, String id})? removed;

  void _maybeFail() {
    final error = failWith;
    if (error != null) throw error;
  }

  @override
  Future<List<LessonSlot>> list(String schoolId) async {
    calls.add('list');
    _maybeFail();
    return List<LessonSlot>.unmodifiable(slots);
  }

  @override
  Future<LessonSlot> create(String schoolId, LessonSlotInput input) async {
    calls.add('create');
    _maybeFail();
    created = (schoolId: schoolId, input: input);
    final slot = _slot('n${slots.length}', schoolId, input);
    slots.add(slot);
    return slot;
  }

  @override
  Future<LessonSlot> update(
    String schoolId,
    String id,
    LessonSlotInput input,
  ) async {
    calls.add('update');
    _maybeFail();
    updated = (schoolId: schoolId, id: id, input: input);
    final slot = _slot(id, schoolId, input);
    slots = <LessonSlot>[for (final s in slots) s.id == id ? slot : s];
    return slot;
  }

  @override
  Future<void> remove(String schoolId, String id) async {
    calls.add('remove');
    _maybeFail();
    removed = (schoolId: schoolId, id: id);
    slots = slots.where((s) => s.id != id).toList();
  }

  static LessonSlot _slot(String id, String schoolId, LessonSlotInput input) =>
      LessonSlot(
        id: id,
        schoolId: schoolId,
        name: input.name.trim(),
        startTime: input.startTime,
        endTime: input.endTime,
      );
}
