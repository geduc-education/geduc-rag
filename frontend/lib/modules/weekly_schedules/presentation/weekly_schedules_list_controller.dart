import 'package:flutter/foundation.dart';

import '../../../core/tenancy/tenant_context.dart';
import '../data/models/schedule_lookups.dart';
import '../data/models/schedule_replication.dart';
import '../data/models/weekly_schedule.dart';
import '../data/weekly_schedules_repository.dart';
import 'schedule_error_messages.dart';

/// Estado de tela da listagem de horários.
enum WeeklySchedulesViewState { loading, ready, empty, error }

const String _loadFallback = 'Não foi possível carregar os horários.';
const String _deleteFallback = 'Não foi possível excluir o horário.';
const String _replicateFallback = 'Não foi possível replicar o horário.';

/// Controller da listagem de horários semanais: filtros escola → turma e
/// período, paginação, exclusão e replicação. Singleton no escopo do shell.
///
/// O backend filtra só por turma; com escola e sem turma, a página é
/// filtrada aqui pelas turmas da escola. Com [tenants], recarrega tudo
/// quando o tenant ativo muda.
class WeeklySchedulesListController extends ChangeNotifier {
  WeeklySchedulesListController(
    this._repository, {
    TenantContext? tenants,
    this.pageSize = 20,
  }) : _tenants = tenants,
       _tenantId = tenants?.activeTenantId {
    tenants?.addListener(_onTenantChanged);
  }

  final IWeeklySchedulesRepository _repository;
  final TenantContext? _tenants;
  final int pageSize;
  String? _tenantId;
  bool _lookupsLoaded = false;
  bool _loadedOnce = false;
  int _generation = 0;

  WeeklySchedulesViewState _state = WeeklySchedulesViewState.loading;
  String? _error;
  List<WeeklyScheduleSummary> _items = const <WeeklyScheduleSummary>[];
  List<ScheduleSchool> _schools = const <ScheduleSchool>[];
  List<ScheduleClass> _classes = const <ScheduleClass>[];
  List<ScheduleSubject> _subjects = const <ScheduleSubject>[];
  ReplicationOutcome? _lastReplication;
  int _page = 1;
  int _total = 0;
  String? _schoolId;
  String? _schoolClassId;
  DateTime? _from;
  DateTime? _to;

  WeeklySchedulesViewState get state => _state;
  String? get error => _error;
  List<WeeklyScheduleSummary> get items => _items;
  List<ScheduleSchool> get schools => _schools;
  List<ScheduleClass> get classes => _classes;
  ReplicationOutcome? get lastReplication => _lastReplication;
  int get page => _page;
  int get total => _total;
  String? get schoolId => _schoolId;
  String? get schoolClassId => _schoolClassId;
  DateTime? get from => _from;
  DateTime? get to => _to;
  int get pageCount => _total == 0 ? 1 : ((_total - 1) ~/ pageSize) + 1;
  bool get hasPrevious => _page > 1;
  bool get hasNext => _page < pageCount;

  /// Turmas oferecidas no filtro: as da escola escolhida, ou todas.
  List<ScheduleClass> get classOptions => _schoolId == null
      ? _classes
      : _classes.where((c) => c.schoolId == _schoolId).toList();

  ScheduleClass? classById(String id) =>
      _classes.where((c) => c.id == id).firstOrNull;

  /// Nome da turma [id], ou o próprio id se ela não veio na lista.
  String className(String id) => classById(id)?.label ?? id;

  /// Nome da disciplina [id] (o resumo da replicação só traz o id).
  String subjectName(String id) =>
      _subjects.where((s) => s.id == id).firstOrNull?.name ?? 'Disciplina';

  /// Escolas, turmas e disciplinas só na primeira visita; a lista sempre recarrega.
  Future<void> bootstrap() async {
    if (!_lookupsLoaded) await loadLookups();
    await load();
  }

  Future<void> loadLookups() async {
    try {
      final (schools, classes, subjects) = await (
        _repository.listSchools(),
        _repository.listClasses(),
        _repository.listSubjects(),
      ).wait;
      _schools = schools;
      _classes = classes;
      _subjects = subjects;
    } catch (_) {
      // Sem os auxiliares os filtros ficam vazios; a lista segue útil.
      _schools = const <ScheduleSchool>[];
      _classes = const <ScheduleClass>[];
      _subjects = const <ScheduleSubject>[];
    }
    _lookupsLoaded = true;
    notifyListeners();
  }

  /// Recarrega com os filtros atuais; respostas ultrapassadas são
  /// descartadas.
  Future<void> load() async {
    _loadedOnce = true;
    final generation = ++_generation;
    _state = WeeklySchedulesViewState.loading;
    notifyListeners();
    WeeklySchedulesPage? result;
    final error = await runScheduleAction(() async {
      result = await _repository.list(
        schoolClassId: _schoolClassId,
        from: _from,
        to: _to,
        page: _page,
        limit: pageSize,
      );
    }, fallback: _loadFallback);
    if (generation != _generation) return;
    _apply(result, error);
    notifyListeners();
  }

  Future<void> setSchool(String? schoolId) {
    if (schoolId == _schoolId) return Future<void>.value();
    _schoolId = schoolId;
    final current = _schoolClassId == null ? null : classById(_schoolClassId!);
    if (current != null && current.schoolId != schoolId) _schoolClassId = null;
    return _reload();
  }

  Future<void> setClass(String? schoolClassId) {
    if (schoolClassId == _schoolClassId) return Future<void>.value();
    _schoolClassId = schoolClassId;
    return _reload();
  }

  /// Intervalo de datas; semanas que cruzam o intervalo entram.
  Future<void> setPeriod({DateTime? from, DateTime? to}) {
    if (from == _from && to == _to) return Future<void>.value();
    _from = from;
    _to = to;
    return _reload();
  }

  Future<void> nextPage() async {
    if (!hasNext) return;
    _page++;
    await load();
  }

  Future<void> previousPage() async {
    if (!hasPrevious) return;
    _page--;
    await load();
  }

  /// Exclusão lógica. `null` em sucesso; senão a mensagem para o toast.
  Future<String?> remove(WeeklyScheduleSummary schedule) async {
    final error = await runScheduleAction(
      () => _repository.remove(schedule.id),
      fallback: _deleteFallback,
    );
    if (error != null) return error;
    if (_items.length == 1 && _page > 1) _page--;
    await load();
    return null;
  }

  /// Replica para as segundas [targets]; o resumo fica em
  /// [lastReplication]. `null` em sucesso; senão a mensagem.
  Future<String?> replicate(
    WeeklyScheduleSummary schedule,
    List<DateTime> targets,
  ) async {
    _lastReplication = null;
    final error = await runScheduleAction(() async {
      _lastReplication = await _repository.replicate(
        schedule.id,
        ReplicateWeeklyScheduleInput(targetMondays: targets),
      );
    }, fallback: _replicateFallback);
    if (error == null) await load();
    return error;
  }

  Future<void> _reload() {
    _page = 1;
    return load();
  }

  void _apply(WeeklySchedulesPage? result, String? error) {
    if (error != null || result == null) {
      _error = error ?? _loadFallback;
      _state = WeeklySchedulesViewState.error;
      return;
    }
    final schoolClasses = classOptions.map((c) => c.id).toSet();
    final bySchool = _schoolId != null && _schoolClassId == null;
    _items = List<WeeklyScheduleSummary>.unmodifiable(
      bySchool
          ? result.items.where((s) => schoolClasses.contains(s.schoolClassId))
          : result.items,
    );
    _total = result.total;
    _error = null;
    _state = _items.isEmpty
        ? WeeklySchedulesViewState.empty
        : WeeklySchedulesViewState.ready;
  }

  void _onTenantChanged() {
    final tenantId = _tenants?.activeTenantId;
    if (tenantId == _tenantId) return;
    _tenantId = tenantId;
    if (!_loadedOnce) return;
    _schoolId = null;
    _schoolClassId = null;
    _page = 1;
    loadLookups();
    load();
  }

  @override
  void dispose() {
    _tenants?.removeListener(_onTenantChanged);
    super.dispose();
  }
}
