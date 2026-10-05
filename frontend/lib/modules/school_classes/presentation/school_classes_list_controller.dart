import 'package:flutter/foundation.dart';

import '../../../core/errors/app_error_messages.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/errors/school_registry_error_messages.dart';
import '../../../core/tenancy/tenant_context.dart';
import '../../../shared/utils/list_filters.dart';
import '../data/models/school_class_model.dart';
import '../data/school_classes_repository.dart';

/// Controller da listagem de turmas: busca, filtros de escola e status,
/// paginação e exclusão lógica.
///
/// Observa o [TenantContext] (com [tenants]): se já carregou, ao trocar de
/// tenant limpa o filtro de escola, volta à 1ª página e recarrega tudo.
class SchoolClassesListController extends ChangeNotifier {
  SchoolClassesListController(
    this._repository, {
    TenantContext? tenants,
    this.pageSize = 20,
  }) : _tenants = tenants,
       _tenantId = tenants?.activeTenantId {
    tenants?.addListener(_onTenantChanged);
  }

  final ISchoolClassesRepository _repository;
  final TenantContext? _tenants;
  final int pageSize;
  String? _tenantId;
  bool _loadedOnce = false;

  ListViewState _state = ListViewState.loading;
  String? _error;
  List<SchoolClassModel> _classes = const <SchoolClassModel>[];
  List<SchoolOption> _schools = const <SchoolOption>[];
  int _page = 1;
  int _total = 0;
  String _search = '';
  String? _schoolId;
  ActiveFilter _filter = ActiveFilter.all;

  ListViewState get state => _state;
  String? get error => _error;
  List<SchoolClassModel> get classes => _classes;

  /// Escolas do filtro (todas, inclusive inativas — podem ter turmas).
  List<SchoolOption> get schools => _schools;
  String? get schoolId => _schoolId;
  int get page => _page;
  int get total => _total;
  ActiveFilter get filter => _filter;
  int get pageCount => _total == 0 ? 1 : ((_total - 1) ~/ pageSize) + 1;
  bool get hasPrevious => _page > 1;
  bool get hasNext => _page < pageCount;

  static const String _loadFallback = 'Não foi possível carregar as turmas.';

  /// Carrega as escolas do filtro e a 1ª página.
  Future<void> bootstrap() async {
    await loadSchools();
    await load();
  }

  /// Opções do filtro de escola. Falha não bloqueia a listagem.
  Future<void> loadSchools() async {
    try {
      _schools = await _repository.listSchoolOptions();
    } catch (_) {
      _schools = const <SchoolOption>[];
    }
    notifyListeners();
  }

  Future<void> load() async {
    _loadedOnce = true;
    _state = ListViewState.loading;
    notifyListeners();
    try {
      final result = await _repository.list(
        SchoolClassQuery(
          page: _page,
          limit: pageSize,
          search: _search,
          active: _filter.queryValue,
          schoolId: _schoolId,
        ),
      );
      _classes = result.items;
      _total = result.total;
      _state = _classes.isEmpty ? ListViewState.empty : ListViewState.ready;
    } on AppException catch (e) {
      _setError(_message(e, _loadFallback));
    } catch (_) {
      _setError(_loadFallback);
    }
    notifyListeners();
  }

  /// Nova busca sempre volta à 1ª página.
  Future<void> search(String term) {
    _search = term;
    _page = 1;
    return load();
  }

  /// Filtra pela escola; `null`/vazio = todas. Volta à 1ª página.
  Future<void> setSchool(String? schoolId) {
    final next = (schoolId == null || schoolId.isEmpty) ? null : schoolId;
    if (next == _schoolId) return Future<void>.value();
    _schoolId = next;
    _page = 1;
    return load();
  }

  /// Troca o filtro de status e volta à 1ª página.
  Future<void> setFilter(ActiveFilter filter) {
    if (filter == _filter) return Future<void>.value();
    _filter = filter;
    _page = 1;
    return load();
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
  Future<String?> remove(SchoolClassModel schoolClass) async {
    const fallback = 'Não foi possível excluir a turma.';
    try {
      await _repository.remove(schoolClass.id);
      if (_classes.length == 1 && _page > 1) _page--;
      await load();
      return null;
    } on AppException catch (e) {
      return _message(e, fallback);
    } catch (_) {
      return fallback;
    }
  }

  static String _message(AppException e, String fallback) =>
      appErrorMessage(e, fallback: fallback, byCode: schoolClassErrorMessages);

  void _setError(String message) {
    _error = message;
    _state = ListViewState.error;
  }

  /// Tenant ativo mudou: escolas e turmas eram do tenant anterior.
  void _onTenantChanged() {
    final tenantId = _tenants?.activeTenantId;
    if (tenantId == _tenantId) return;
    _tenantId = tenantId;
    if (!_loadedOnce) return;
    _page = 1;
    _schoolId = null;
    bootstrap();
  }

  @override
  void dispose() {
    _tenants?.removeListener(_onTenantChanged);
    super.dispose();
  }
}
