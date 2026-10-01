import 'package:flutter/foundation.dart';

import '../../../core/errors/app_exception.dart';
import '../data/academic_calendar_repository.dart';
import '../data/models/calendar_event.dart';
import '../data/models/calendar_school.dart';

/// Estado da carga dos registros do mês.
enum AcademicCalendarViewState { loading, ready, error }

const String _loadError = 'Não foi possível carregar o calendário.';
const String _saveError = 'Não foi possível salvar o registro.';
const String _deleteError = 'Não foi possível excluir o registro.';

/// Controller do Calendário Acadêmico. Singleton no escopo do shell: guarda o
/// mês exibido e os filtros entre as visitas à aba.
///
/// Os filtros têm rascunho ([schoolId]/[type], editados nos combos) e valor
/// aplicado — a busca só muda ao acionar [search], como no botão "Buscar".
class AcademicCalendarController extends ChangeNotifier {
  AcademicCalendarController(this._repository, {DateTime Function()? clock})
    : _month = _firstDayOf((clock ?? DateTime.now)());

  final IAcademicCalendarRepository _repository;

  AcademicCalendarViewState _state = AcademicCalendarViewState.loading;
  String? _error;
  DateTime _month;
  List<CalendarSchool> _schools = const <CalendarSchool>[];
  bool _schoolsLoaded = false;
  List<CalendarEvent> _events = const <CalendarEvent>[];
  Map<int, List<CalendarEvent>> _byDay = const <int, List<CalendarEvent>>{};
  bool _hasLoaded = false;
  int _generation = 0;

  String? _schoolId;
  CalendarEventType? _type;
  String? _appliedSchoolId;
  CalendarEventType? _appliedType;

  AcademicCalendarViewState get state => _state;
  String? get error => _error;

  /// Primeiro dia do mês exibido.
  DateTime get month => _month;
  List<CalendarSchool> get schools => _schools;
  bool get schoolsLoaded => _schoolsLoaded;

  /// Registros do mês, ordenados por data.
  List<CalendarEvent> get events => _events;
  String? get schoolId => _schoolId;
  CalendarEventType? get type => _type;

  /// Registros do [day] do mês exibido (vazio se não houver).
  List<CalendarEvent> eventsOn(int day) =>
      _byDay[day] ?? const <CalendarEvent>[];

  /// Quantidade de registros do [type] no mês.
  int countOf(CalendarEventType type) =>
      _events.where((e) => e.type == type).length;

  /// Carrega escolas e registros só na primeira visita da sessão.
  Future<void> ensureLoaded() async {
    if (_hasLoaded) return;
    await Future.wait(<Future<void>>[_loadSchools(), load()]);
  }

  void selectSchool(String? schoolId) {
    _schoolId = schoolId;
    notifyListeners();
  }

  void selectType(CalendarEventType? type) {
    _type = type;
    notifyListeners();
  }

  /// Aplica os filtros em rascunho e recarrega o mês.
  Future<void> search() {
    _appliedSchoolId = _schoolId;
    _appliedType = _type;
    return load();
  }

  Future<void> previousMonth() => _goTo(-1);

  Future<void> nextMonth() => _goTo(1);

  /// Recarrega o mês com os filtros aplicados. Respostas de buscas
  /// ultrapassadas (troca rápida de mês) são descartadas.
  Future<void> load() async {
    final generation = ++_generation;
    _state = AcademicCalendarViewState.loading;
    notifyListeners();
    try {
      final events = await _repository.listEvents(
        year: _month.year,
        month: _month.month,
        schoolId: _appliedSchoolId,
        type: _appliedType,
      );
      if (generation != _generation) return;
      _apply(events);
    } on AppException catch (e) {
      if (generation == _generation) _fail(e.message);
    } catch (_) {
      if (generation == _generation) _fail(_loadError);
    }
    notifyListeners();
  }

  /// Cria ([id] nulo) ou edita um registro e recarrega o mês. Devolve a
  /// mensagem de erro, ou `null` em caso de sucesso.
  Future<String?> save(CalendarEventInput input, {String? id}) =>
      _mutate(_saveError, () async {
        if (id == null) {
          await _repository.create(input);
        } else {
          await _repository.update(id, input);
        }
      });

  /// Exclui o registro [id] e recarrega o mês. Devolve a mensagem de erro, ou
  /// `null` em caso de sucesso.
  Future<String?> delete(String id) =>
      _mutate(_deleteError, () => _repository.delete(id));

  Future<String?> _mutate(String fallback, Future<void> Function() run) async {
    try {
      await run();
    } on AppException catch (e) {
      return e.message;
    } catch (_) {
      return fallback;
    }
    await load();
    return null;
  }

  Future<void> _goTo(int delta) {
    _month = DateTime(_month.year, _month.month + delta);
    return load();
  }

  Future<void> _loadSchools() async {
    try {
      _schools = await _repository.listSchools();
    } catch (_) {
      // Sem escolas o filtro fica vazio; o calendário da rede segue útil.
      _schools = const <CalendarSchool>[];
    }
    _schoolsLoaded = true;
    notifyListeners();
  }

  void _apply(List<CalendarEvent> events) {
    _events = List<CalendarEvent>.unmodifiable(events);
    final byDay = <int, List<CalendarEvent>>{};
    for (final event in events) {
      byDay.putIfAbsent(event.date.day, () => <CalendarEvent>[]).add(event);
    }
    _byDay = byDay;
    _error = null;
    _hasLoaded = true;
    _state = AcademicCalendarViewState.ready;
  }

  void _fail(String message) {
    _error = message;
    _state = AcademicCalendarViewState.error;
  }

  static DateTime _firstDayOf(DateTime date) => DateTime(date.year, date.month);
}
