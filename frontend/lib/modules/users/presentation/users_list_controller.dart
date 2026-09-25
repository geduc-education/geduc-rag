import 'package:flutter/foundation.dart';

import '../../../core/errors/app_exception.dart';
import '../data/models/user_model.dart';
import '../data/users_repository.dart';

/// Estado de tela genérico das listagens.
enum ViewState { loading, ready, error, empty }

/// Controller da listagem de usuários: busca, paginação e as ações inline
/// (inativar/reativar, redefinir senha, excluir).
class UsersListController extends ChangeNotifier {
  UsersListController(this._repository, {this.pageSize = 20});

  final IUsersRepository _repository;
  final int pageSize;

  ViewState _state = ViewState.loading;
  String? _error;
  List<UserModel> _users = const <UserModel>[];
  int _page = 1;
  int _total = 0;
  String _search = '';

  ViewState get state => _state;
  String? get error => _error;
  List<UserModel> get users => _users;
  int get page => _page;
  int get total => _total;
  int get pageCount => _total == 0 ? 1 : ((_total - 1) ~/ pageSize) + 1;
  bool get hasPrevious => _page > 1;
  bool get hasNext => _page < pageCount;

  Future<void> bootstrap() => load();

  Future<void> load() async {
    _state = ViewState.loading;
    notifyListeners();
    try {
      final result = await _repository.list(
        page: _page,
        limit: pageSize,
        search: _search,
      );
      _users = result.items;
      _total = result.total;
      _state = _users.isEmpty ? ViewState.empty : ViewState.ready;
    } on AppException catch (e) {
      _error = e.message;
      _state = ViewState.error;
    } catch (_) {
      _error = 'Não foi possível carregar os usuários.';
      _state = ViewState.error;
    }
    notifyListeners();
  }

  /// Nova busca sempre volta à 1ª página.
  Future<void> search(String term) {
    _search = term;
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

  /// Alterna ativo/inativo. `null` em sucesso; senão a mensagem de erro.
  Future<String?> toggleActive(UserModel user) => _run(() async {
    final updated = await _repository.setActive(user.id, active: !user.active);
    _users = <UserModel>[
      for (final u in _users)
        if (u.id == updated.id) updated else u,
    ];
  }, 'Não foi possível alterar o usuário.');

  Future<String?> resetPassword(UserModel user, String password) => _run(
    () => _repository.resetPassword(user.id, password),
    'Não foi possível redefinir a senha.',
  );

  Future<String?> remove(UserModel user) => _run(() async {
    await _repository.remove(user.id);
    await load();
  }, 'Não foi possível excluir o usuário.');

  /// Executa uma ação e devolve `null` em sucesso ou a mensagem de erro — a
  /// página mostra o resultado em toast.
  Future<String?> _run(Future<void> Function() action, String fallback) async {
    try {
      await action();
      notifyListeners();
      return null;
    } on AppException catch (e) {
      return e.message;
    } catch (_) {
      return fallback;
    }
  }
}
