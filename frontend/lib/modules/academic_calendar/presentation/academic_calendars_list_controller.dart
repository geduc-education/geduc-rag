import 'package:flutter/foundation.dart';

import '../../../core/tenancy/tenant_context.dart';
import '../data/academic_calendar_repository.dart';
import '../data/models/academic_calendar.dart';
import '../data/models/calendar_school.dart';
import 'calendar_error_messages.dart';

/// Estado de tela da listagem de calendários.
enum AcademicCalendarsViewState { loading, ready, empty, error }

const String _loadFallback = 'Não foi possível carregar os calendários.';
const String _deleteFallback = 'Não foi possível excluir o calendário.';

/// Controller da seleção de calendários: filtros por ano e escola, a lista do
/// tenant, as escolas (para filtro e cadastro) e a exclusão. Singleton no
/// escopo do shell — os filtros sobrevivem às visitas à aba.
///
/// Com [tenants], observa o [TenantContext] e recarrega tudo quando o tenant
/// ativo muda (os dados eram do tenant anterior).
class AcademicCalendarsListController extends ChangeNotifier {
  AcademicCalendarsListController(
    this._repository, {
    TenantContext? tenants,
    DateTime Function()? clock,
  }) : _tenants = tenants,
       _tenantId = tenants?.activeTenantId,
       _clock = clock ?? DateTime.now {
    tenants?.addListener(_onTenantChanged);
  }

  final IAcademicCalendarRepository _repository;
  final TenantContext? _tenants;
  final DateTime Function() _clock;
  String? _tenantId;
  bool _loadedOnce = false;
  int _generation = 0;

  AcademicCalendarsViewState _state = AcademicCalendarsViewState.loading;
  String? _error;
  List<AcademicCalendar> _calendars = const <AcademicCalendar>[];
  List<CalendarSchool> _schools = const <CalendarSchool>[];
  bool _schoolsLoaded = false;
  int? _year;
  String? _schoolId;

  AcademicCalendarsViewState get state => _state;
  String? get error => _error;
  List<AcademicCalendar> get calendars => _calendars;
  List<CalendarSchool> get schools => _schools;
  bool get schoolsLoaded => _schoolsLoaded;

  /// Filtro de ano; `null` = todos.
  int? get year => _year;

  /// Filtro de escola; `null` = todas.
  String? get schoolId => _schoolId;

  /// Anos oferecidos nos seletores: dois para trás e dois à frente.
  List<int> get yearOptions {
    final current = _clock().year;
    return <int>[for (var y = current - 2; y <= current + 2; y++) y];
  }

  /// Nome da escola [id], ou o próprio id se ela não veio na lista.
  String schoolName(String id) =>
      _schools.where((s) => s.id == id).firstOrNull?.name ?? id;

  /// Carrega escolas e calendários só na primeira visita da sessão.
  Future<void> ensureLoaded() async {
    if (_loadedOnce) return;
    await Future.wait(<Future<void>>[loadSchools(), load()]);
  }

  Future<void> setYear(int? year) {
    if (year == _year) return Future<void>.value();
    _year = year;
    return load();
  }

  Future<void> setSchool(String? schoolId) {
    if (schoolId == _schoolId) return Future<void>.value();
    _schoolId = schoolId;
    return load();
  }

  /// Recarrega a lista com os filtros atuais. Respostas de buscas
  /// ultrapassadas (troca rápida de filtro) são descartadas.
  Future<void> load() async {
    _loadedOnce = true;
    final generation = ++_generation;
    _state = AcademicCalendarsViewState.loading;
    notifyListeners();
    List<AcademicCalendar>? items;
    final error = await runCalendarAction(() async {
      final page = await _repository.list(year: _year, schoolId: _schoolId);
      items = page.items;
    }, fallback: _loadFallback);
    if (generation != _generation) return;
    _apply(items, error);
    notifyListeners();
  }

  Future<void> loadSchools() async {
    try {
      _schools = await _repository.listSchools();
    } catch (_) {
      // Sem escolas o filtro fica vazio; calendários de todas seguem úteis.
      _schools = const <CalendarSchool>[];
    }
    _schoolsLoaded = true;
    notifyListeners();
  }

  /// Exclui o calendário e recarrega. `null` em sucesso; senão a mensagem.
  Future<String?> remove(AcademicCalendar calendar) async {
    final error = await runCalendarAction(
      () => _repository.remove(calendar.id),
      fallback: _deleteFallback,
    );
    if (error == null) await load();
    return error;
  }

  void _apply(List<AcademicCalendar>? items, String? error) {
    if (error != null || items == null) {
      _error = error ?? _loadFallback;
      _state = AcademicCalendarsViewState.error;
      return;
    }
    _calendars = List<AcademicCalendar>.unmodifiable(items);
    _error = null;
    _state = _calendars.isEmpty
        ? AcademicCalendarsViewState.empty
        : AcademicCalendarsViewState.ready;
  }

  void _onTenantChanged() {
    final tenantId = _tenants?.activeTenantId;
    if (tenantId == _tenantId) return;
    _tenantId = tenantId;
    if (!_loadedOnce) return;
    _schoolId = null;
    loadSchools();
    load();
  }

  @override
  void dispose() {
    _tenants?.removeListener(_onTenantChanged);
    super.dispose();
  }
}
