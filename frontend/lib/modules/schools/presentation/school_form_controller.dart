import 'package:flutter/foundation.dart';

import '../../../core/errors/app_error_messages.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/errors/school_registry_error_messages.dart';
import '../data/models/school_input.dart';
import '../data/models/school_model.dart';
import '../data/schools_repository.dart';

/// Controller do formulário de escola (criar/editar). Ao criar, passa a
/// editar a escola criada (o id libera a seção de horários das aulas).
class SchoolFormController extends ChangeNotifier {
  SchoolFormController(this._repository, {SchoolModel? editing})
    : _editing = editing,
      _active = editing?.active ?? true;

  final ISchoolsRepository _repository;
  SchoolModel? _editing;

  /// Escola em edição; `null` = criação ainda não salva.
  SchoolModel? get editing => _editing;

  bool get isEditing => _editing != null;

  bool _saving = false;
  String? _error;
  bool _active;

  bool get saving => _saving;
  String? get error => _error;
  bool get active => _active;

  void setActive(bool value) {
    _active = value;
    notifyListeners();
  }

  /// Persiste a escola. Retorna `true` em sucesso.
  Future<bool> save({required String name}) async {
    _saving = true;
    _error = null;
    notifyListeners();
    try {
      final input = SchoolInput(name: name, active: _active);
      final current = _editing;
      _editing = current == null
          ? await _repository.create(input)
          : await _repository.update(current.id, input);
      _saving = false;
      notifyListeners();
      return true;
    } on AppException catch (e) {
      return _fail(
        appErrorMessage(
          e,
          fallback: _saveFallback,
          byCode: schoolErrorMessages,
        ),
      );
    } catch (_) {
      return _fail(_saveFallback);
    }
  }

  static const String _saveFallback = 'Não foi possível salvar a escola.';

  bool _fail(String message) {
    _error = message;
    _saving = false;
    notifyListeners();
    return false;
  }
}
