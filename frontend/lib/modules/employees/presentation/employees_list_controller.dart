import 'package:flutter/foundation.dart';

import '../../../core/errors/app_exception.dart';
import '../../../core/tenancy/tenant_context.dart';
import '../data/employees_repository.dart';
import '../data/models/employee_model.dart';
import 'employee_error_messages.dart';

/// Estado de tela da listagem de funcionários.
enum EmployeesViewState { loading, ready, error, empty }

/// Filtro de status da listagem (`active` da query).
enum EmployeeActiveFilter {
  all(null, 'Todos'),
  active(true, 'Ativos'),
  inactive(false, 'Inativos');

  const EmployeeActiveFilter(this.queryValue, this.label);

  /// Valor enviado em `?active=`; `null` = sem filtro.
  final bool? queryValue;
  final String label;
}

/// Controller da listagem de funcionários: busca, filtro de status,
/// paginação e as exclusões lógica e definitiva.
///
/// Os dados pertencem ao tenant ativo: com [tenants], o controller observa o
/// [TenantContext] e, se já carregou, volta à 1ª página e recarrega quando o
/// tenant muda.
class EmployeesListController extends ChangeNotifier {
  EmployeesListController(
    this._repository, {
    TenantContext? tenants,
    this.pageSize = 20,
  }) : _tenants = tenants,
       _tenantId = tenants?.activeTenantId {
    tenants?.addListener(_onTenantChanged);
  }

  final IEmployeesRepository _repository;
  final TenantContext? _tenants;
  final int pageSize;
  String? _tenantId;
  bool _loadedOnce = false;

  EmployeesViewState _state = EmployeesViewState.loading;
  String? _error;
  List<EmployeeModel> _employees = const <EmployeeModel>[];
  int _page = 1;
  int _total = 0;
  String _search = '';
  EmployeeActiveFilter _filter = EmployeeActiveFilter.all;

  EmployeesViewState get state => _state;
  String? get error => _error;
  List<EmployeeModel> get employees => _employees;
  int get page => _page;
  int get total => _total;
  EmployeeActiveFilter get filter => _filter;
  int get pageCount => _total == 0 ? 1 : ((_total - 1) ~/ pageSize) + 1;
  bool get hasPrevious => _page > 1;
  bool get hasNext => _page < pageCount;

  Future<void> bootstrap() => load();

  Future<void> load() async {
    _loadedOnce = true;
    _state = EmployeesViewState.loading;
    notifyListeners();
    try {
      final result = await _repository.list(
        page: _page,
        limit: pageSize,
        search: _search,
        active: _filter.queryValue,
      );
      _employees = result.items;
      _total = result.total;
      _state = _employees.isEmpty
          ? EmployeesViewState.empty
          : EmployeesViewState.ready;
    } on AppException catch (e) {
      _setError(
        employeeErrorMessage(
          e,
          fallback: 'Não foi possível carregar os funcionários.',
        ),
      );
    } catch (_) {
      _setError('Não foi possível carregar os funcionários.');
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
  Future<void> setFilter(EmployeeActiveFilter filter) {
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
  Future<String?> remove(EmployeeModel employee) => _run(() async {
    await _repository.remove(employee.id);
    await _reloadAfterRemoval();
  }, 'Não foi possível excluir o funcionário.');

  /// Exclusão definitiva (irreversível). `null` em sucesso; senão a mensagem.
  Future<String?> purge(EmployeeModel employee) => _run(() async {
    await _repository.purge(employee.id);
    await _reloadAfterRemoval();
  }, 'Não foi possível excluir definitivamente o funcionário.');

  /// Recarrega após remover; se a página ficou vazia, recua uma.
  Future<void> _reloadAfterRemoval() async {
    if (_employees.length == 1 && _page > 1) _page--;
    await load();
  }

  Future<String?> _run(Future<void> Function() action, String fallback) async {
    try {
      await action();
      return null;
    } on AppException catch (e) {
      return employeeErrorMessage(e, fallback: fallback);
    } catch (_) {
      return fallback;
    }
  }

  void _setError(String message) {
    _error = message;
    _state = EmployeesViewState.error;
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
