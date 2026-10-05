import '../../../core/http/api_client.dart';
import 'models/lesson_slot.dart';

/// Contrato dos horários de aula de uma escola
/// (`/schools/:schoolId/lesson-slots`). O header `tenant-id` vem do
/// [ApiClient].
abstract interface class ILessonSlotsRepository {
  /// Lista já ordenada pela API.
  Future<List<LessonSlot>> list(String schoolId);
  Future<LessonSlot> create(String schoolId, LessonSlotInput input);
  Future<LessonSlot> update(String schoolId, String id, LessonSlotInput input);
  Future<void> remove(String schoolId, String id);
}

class LessonSlotsRepository implements ILessonSlotsRepository {
  LessonSlotsRepository(this._client);

  final ApiClient _client;

  static String _path(String schoolId) => '/schools/$schoolId/lesson-slots';

  @override
  Future<List<LessonSlot>> list(String schoolId) async {
    final response = await _client.get<Map<String, dynamic>>(_path(schoolId));
    return LessonSlot.listFromJson(response.data ?? const <String, dynamic>{});
  }

  @override
  Future<LessonSlot> create(String schoolId, LessonSlotInput input) async {
    final response = await _client.post<Map<String, dynamic>>(
      _path(schoolId),
      data: input.toJson(),
    );
    return _slot(response.data);
  }

  @override
  Future<LessonSlot> update(
    String schoolId,
    String id,
    LessonSlotInput input,
  ) async {
    final response = await _client.patch<Map<String, dynamic>>(
      '${_path(schoolId)}/$id',
      data: input.toJson(),
    );
    return _slot(response.data);
  }

  @override
  Future<void> remove(String schoolId, String id) =>
      _client.delete<void>('${_path(schoolId)}/$id');

  LessonSlot _slot(Map<String, dynamic>? data) =>
      LessonSlot.fromJson(data ?? const <String, dynamic>{});
}
