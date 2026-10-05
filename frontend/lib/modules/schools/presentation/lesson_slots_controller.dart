import 'package:flutter/foundation.dart';

import '../../../core/errors/app_error_messages.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/errors/school_registry_error_messages.dart';
import '../../../shared/utils/list_filters.dart';
import '../data/lesson_slots_repository.dart';
import '../data/models/lesson_slot.dart';

const String _loadFallback = 'Não foi possível carregar os horários das aulas.';
const String _saveFallback = 'Não foi possível salvar o horário da aula.';
const String _removeFallback = 'Não foi possível excluir o horário da aula.';

/// Controller da seção "Horários das aulas" de uma escola já salva: lista
/// (na ordem da API), cria, edita e exclui. Instanciado pela seção e
/// descartado com ela.
class LessonSlotsController extends ChangeNotifier {
  LessonSlotsController(this._repository, {required this.schoolId});

  final ILessonSlotsRepository _repository;
  final String schoolId;

  ListViewState _state = ListViewState.loading;
  String? _error;
  List<LessonSlot> _slots = const <LessonSlot>[];

  ListViewState get state => _state;
  String? get error => _error;
  List<LessonSlot> get slots => _slots;

  Future<void> load() async {
    _state = ListViewState.loading;
    notifyListeners();
    final error = await _run(() async {
      _slots = await _repository.list(schoolId);
    }, _loadFallback);
    _error = error;
    _state = error != null
        ? ListViewState.error
        : (_slots.isEmpty ? ListViewState.empty : ListViewState.ready);
    notifyListeners();
  }

  /// Cria ([editing] `null`) ou edita o horário e recarrega a lista (a API
  /// define a ordem). `null` em sucesso; senão a mensagem para o banner.
  Future<String?> save(LessonSlotInput input, {LessonSlot? editing}) async {
    final error = await _run(
      () => editing == null
          ? _repository.create(schoolId, input)
          : _repository.update(schoolId, editing.id, input),
      _saveFallback,
    );
    if (error == null) await load();
    return error;
  }

  /// Exclui o horário. `null` em sucesso; senão a mensagem para o toast.
  Future<String?> remove(LessonSlot slot) async {
    final error = await _run(
      () => _repository.remove(schoolId, slot.id),
      _removeFallback,
    );
    if (error == null) await load();
    return error;
  }

  static Future<String?> _run(
    Future<void> Function() action,
    String fallback,
  ) async {
    try {
      await action();
      return null;
    } on AppException catch (e) {
      return appErrorMessage(
        e,
        fallback: fallback,
        byCode: lessonSlotErrorMessages,
      );
    } catch (_) {
      return fallback;
    }
  }
}
