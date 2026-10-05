import 'package:flutter/foundation.dart';

import '../../../core/errors/app_error_messages.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/errors/school_registry_error_messages.dart';
import '../data/models/school_class_input.dart';
import '../data/models/school_class_model.dart';
import '../data/school_classes_repository.dart';

/// Controller do formulário de turma (criar/editar).
///
/// Escola e ano letivo só são escolhidos na criação (imutáveis no backend);
/// na edição apenas nome e situação vão no `PATCH`.
class SchoolClassFormController extends ChangeNotifier {
  SchoolClassFormController(this._repository, {this.editing})
    : _active = editing?.active ?? true,
      _schoolId = editing?.schoolId;

  final ISchoolClassesRepository _repository;

  /// Turma em edição; `null` = criação.
  final SchoolClassModel? editing;

  bool get isEditing => editing != null;

  bool _loadingSchools = false;
  bool _saving = false;
  String? _error;
  List<SchoolOption> _schools = const <SchoolOption>[];
  String? _schoolId;
  bool _active;

  bool get loadingSchools => _loadingSchools;
  bool get saving => _saving;
  String? get error => _error;

  /// Escolas ativas do tenant (opções do seletor na criação).
  List<SchoolOption> get schools => _schools;
  String? get schoolId => _schoolId;
  bool get active => _active;

  /// Carrega as escolas ativas — só na criação.
  Future<void> bootstrap() async {
    if (isEditing) return;
    _loadingSchools = true;
    notifyListeners();
    try {
      _schools = await _repository.listSchoolOptions(active: true);
    } on AppException catch (e) {
      _error = _message(e, _schoolsFallback);
    } catch (_) {
      _error = _schoolsFallback;
    }
    _loadingSchools = false;
    notifyListeners();
  }

  void selectSchool(String? schoolId) {
    _schoolId = (schoolId == null || schoolId.isEmpty) ? null : schoolId;
    notifyListeners();
  }

  void setActive(bool value) {
    _active = value;
    notifyListeners();
  }

  /// Persiste a turma. Retorna `true` em sucesso. [schoolYear] é ignorado na
  /// edição.
  Future<bool> save({required String name, required int schoolYear}) async {
    final current = editing;
    final schoolId = _schoolId;
    if (current == null && schoolId == null) {
      return _fail('Selecione a escola da turma.');
    }
    _saving = true;
    _error = null;
    notifyListeners();
    try {
      current == null
          ? await _repository.create(
              CreateSchoolClassInput(
                schoolId: schoolId!,
                schoolYear: schoolYear,
                name: name,
                active: _active,
              ),
            )
          : await _repository.update(
              current.id,
              UpdateSchoolClassInput(name: name, active: _active),
            );
      _saving = false;
      notifyListeners();
      return true;
    } on AppException catch (e) {
      return _fail(_message(e, _saveFallback));
    } catch (_) {
      return _fail(_saveFallback);
    }
  }

  static const String _saveFallback = 'Não foi possível salvar a turma.';
  static const String _schoolsFallback =
      'Não foi possível carregar as escolas.';

  static String _message(AppException e, String fallback) =>
      appErrorMessage(e, fallback: fallback, byCode: schoolClassErrorMessages);

  bool _fail(String message) {
    _error = message;
    _saving = false;
    notifyListeners();
    return false;
  }
}
