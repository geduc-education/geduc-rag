import 'package:flutter/foundation.dart';

import '../data/academic_calendar_repository.dart';
import '../data/models/academic_calendar.dart';
import 'calendar_error_messages.dart';

const String _saveFallback = 'Não foi possível salvar o calendário.';
const String _missingDates = 'Informe a data de início e a data de fim.';
const String _invalidRange =
    'O período deve estar dentro do ano letivo e o início não pode ser '
    'posterior ao fim.';
const String _missingSchools =
    'Selecione ao menos uma escola ou marque "Todas as escolas".';

/// Controller do formulário de calendário (criar/editar). Instanciado pelo
/// diálogo e descartado com ele.
///
/// Ano e período só são editáveis na criação — o backend os trata como
/// imutáveis; na edição seguem só nome e escolas.
class AcademicCalendarFormController extends ChangeNotifier {
  AcademicCalendarFormController(
    this._repository, {
    required int defaultYear,
    this.editing,
  }) : _year = editing?.year ?? defaultYear,
       _startDate = editing?.startDate,
       _endDate = editing?.endDate,
       _allSchools = editing?.allSchools ?? true,
       _schoolIds = <String>{...?editing?.schoolIds};

  final IAcademicCalendarRepository _repository;

  /// Calendário em edição; `null` = criação.
  final AcademicCalendar? editing;

  bool get isEditing => editing != null;

  int _year;
  DateTime? _startDate;
  DateTime? _endDate;
  bool _allSchools;
  final Set<String> _schoolIds;
  bool _saving = false;
  String? _error;

  int get year => _year;
  DateTime? get startDate => _startDate;
  DateTime? get endDate => _endDate;
  bool get allSchools => _allSchools;
  Set<String> get schoolIds => Set<String>.unmodifiable(_schoolIds);
  bool get saving => _saving;
  String? get error => _error;

  void setYear(int year) {
    _year = year;
    notifyListeners();
  }

  void setStartDate(DateTime? date) => _startDate = date;

  void setEndDate(DateTime? date) => _endDate = date;

  void setAllSchools(bool value) {
    _allSchools = value;
    notifyListeners();
  }

  void toggleSchool(String id) {
    if (!_schoolIds.remove(id)) _schoolIds.add(id);
    notifyListeners();
  }

  /// Valida e persiste. Devolve o calendário salvo, ou `null` com [error].
  Future<AcademicCalendar?> save(String name) async {
    final invalid = _validate();
    if (invalid != null) {
      _error = invalid;
      notifyListeners();
      return null;
    }
    _saving = true;
    _error = null;
    notifyListeners();
    AcademicCalendar? saved;
    final error = await runCalendarAction(
      () async => saved = await _persist(name),
      fallback: _saveFallback,
    );
    _saving = false;
    _error = error;
    notifyListeners();
    return error == null ? saved : null;
  }

  Future<AcademicCalendar> _persist(String name) {
    final ids = _allSchools ? const <String>[] : _schoolIds.toList();
    final current = editing;
    if (current != null) {
      return _repository.update(
        current.id,
        UpdateAcademicCalendarInput(
          name: name,
          allSchools: _allSchools,
          schoolIds: _allSchools ? null : ids,
        ),
      );
    }
    return _repository.create(
      CreateAcademicCalendarInput(
        year: _year,
        name: name,
        startDate: _startDate!,
        endDate: _endDate!,
        allSchools: _allSchools,
        schoolIds: ids,
      ),
    );
  }

  String? _validate() {
    if (!_allSchools && _schoolIds.isEmpty) return _missingSchools;
    if (isEditing) return null;
    final start = _startDate;
    final end = _endDate;
    if (start == null || end == null) return _missingDates;
    final inYear = start.year == _year && end.year == _year;
    return inYear && !start.isAfter(end) ? null : _invalidRange;
  }
}
