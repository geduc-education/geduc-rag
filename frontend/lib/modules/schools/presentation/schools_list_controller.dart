import 'package:flutter/foundation.dart';

import '../../../core/errors/app_error_messages.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/errors/school_registry_error_messages.dart';
import '../../../core/tenancy/tenant_context.dart';
import '../../../shared/utils/list_filters.dart';
import '../data/models/school_model.dart';
import '../data/schools_repository.dart';

/// Controller da listagem de escolas: busca, filtro de status, paginação e
/// exclusão lógica.
///
/// Os dados pertencem ao tenant ativo: com [tenants], o controller observa o
/// [TenantContext] e, se já carregou, volta à 1ª página e recarrega quando o
/// tenant muda.
class SchoolsListController extends ChangeNotifier {
  SchoolsListController(
    this._repository, {
    TenantContext? tenants,
    this.pageSize = 20,
  }) : _tenants = tenants,
       _tenantId = tenants?.activeTenantId {
    tenants?.addListener(_onTenantChanged);
  }

  final ISchoolsRepository _repository;
  final TenantContext? _tenants;
  final int pageSize;
  String? _tenantId;
  bool _loadedOnce = false;

  ListViewState _state = ListViewState.loading;
  String? _error;
  List<SchoolModel> _schools = const <SchoolModel>[];
  int _page = 1;
  int _total = 0;
  String _search = '';
  ActiveFilter _filter = ActiveFilter.all;

  ListViewState get state => _state;
  String? get error => _error;
  List<SchoolModel> get schools => _schools;
  int get page => _page;
  int get total => _total;
  ActiveFilter get filter => _filter;
  int get pageCount => _total == 0 ? 1 : ((_total - 1) ~/ pageSize) + 1;
  bool get hasPrevious => _page > 1;
  bool get hasNext => _page < pageCount;

  static const String _loadFallback = 'Não foi possível carregar as escolas.';

  Future<void> bootstrap() => load();

  Future<void> load() async {
    _loadedOnce = true;
    _state = ListViewState.loading;
    notifyListeners();
    try {
      final result = await _repository.list(
        page: _page,
        limit: pageSize,
        search: _search,
        active: _filter.queryValue,
      );
      _schools = result.items;
      _total = result.total;
      _state = _schools.isEmpty ? ListViewState.empty : ListViewState.ready;
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
  Future<String?> remove(SchoolModel school) async {
    const fallback = 'Não foi possível excluir a escola.';
    try {
      await _repository.remove(school.id);
      if (_schools.length == 1 && _page > 1) _page--;
      await load();
      return null;
    } on AppException catch (e) {
      return _message(e, fallback);
    } catch (_) {
      return fallback;
    }
  }

  static String _message(AppException e, String fallback) =>
      appErrorMessage(e, fallback: fallback, byCode: schoolErrorMessages);

  void _setError(String message) {
    _error = message;
    _state = ListViewState.error;
  }

  /// Tenant ativo mudou: a lista era do tenant anterior — recarrega.
  void _onTenantChanged() {
    final tenantId = _tenants?.activeTenantId;
    if (tenantId == _tenantId) return;
    _tenantId = tenantId;
    if (!_loadedOnce) return;
    _page = 1;
    load();
  }

  @override
  void dispose() {
    _tenants?.removeListener(_onTenantChanged);
    super.dispose();
  }
}
