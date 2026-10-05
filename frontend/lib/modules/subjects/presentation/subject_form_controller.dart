import 'package:flutter/foundation.dart';

import '../../../core/errors/app_error_messages.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/errors/school_registry_error_messages.dart';
import '../data/models/subject_input.dart';
import '../data/models/subject_model.dart';
import '../data/subjects_repository.dart';

/// Controller do formulário de disciplina (criar/editar).
class SubjectFormController extends ChangeNotifier {
  SubjectFormController(this._repository, {this.editing})
    : _active = editing?.active ?? true;

  final ISubjectsRepository _repository;

  /// Disciplina em edição; `null` = criação.
  final SubjectModel? editing;

  bool get isEditing => editing != null;

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

  /// Persiste a disciplina. Retorna `true` em sucesso.
  Future<bool> save({required String name}) async {
    _saving = true;
    _error = null;
    notifyListeners();
    try {
      final input = SubjectInput(name: name, active: _active);
      final current = editing;
      current == null
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
          byCode: subjectErrorMessages,
        ),
      );
    } catch (_) {
      return _fail(_saveFallback);
    }
  }

  static const String _saveFallback = 'Não foi possível salvar a disciplina.';

  bool _fail(String message) {
    _error = message;
    _saving = false;
    notifyListeners();
    return false;
  }
}
