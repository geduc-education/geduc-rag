import 'package:flutter/foundation.dart';

import '../../../core/errors/app_exception.dart';
import '../data/employees_repository.dart';
import '../data/models/employee_input.dart';
import '../data/models/employee_model.dart';
import 'employee_error_messages.dart';

/// Controller do formulário de funcionário (criar/editar).
///
/// O seletor de usuário vinculado só existe com [canLinkUser] (o ator tem
/// `user:read`/`user:manage`); sem ele o campo some e o `userId` nunca vai no
/// corpo — na edição, o vínculo atual é preservado pelo backend.
class EmployeeFormController extends ChangeNotifier {
  EmployeeFormController(
    this._repository, {
    this.editing,
    this.canLinkUser = false,
    this.tenantId,
  }) : _selectedUserId = editing?.userId,
       _active = editing?.active ?? true;

  final IEmployeesRepository _repository;

  /// Funcionário em edição; `null` = criação.
  final EmployeeModel? editing;

  /// Exibe o seletor de usuário vinculado (gating por permissão de usuário).
  final bool canLinkUser;

  /// Tenant ativo — filtra os usuários elegíveis ao vínculo.
  final String? tenantId;

  bool get isEditing => editing != null;

  bool _loadingUsers = false;
  bool _saving = false;
  String? _error;
  String? _usersError;
  List<LinkableUser> _users = const <LinkableUser>[];
  String? _selectedUserId;
  bool _active;

  bool get loadingUsers => _loadingUsers;
  bool get saving => _saving;
  String? get error => _error;

  /// Falha ao carregar as opções de usuário (não bloqueia o formulário).
  String? get usersError => _usersError;
  List<LinkableUser> get users => _users;
  String? get selectedUserId => _selectedUserId;
  bool get active => _active;

  /// O usuário vinculado atual não veio na lista (fora do limite de 100 ou do
  /// alcance do ator) — a UI o mostra como opção à parte.
  bool get linkedUserMissing =>
      _selectedUserId != null && !_users.any((u) => u.id == _selectedUserId);

  /// Carrega as opções do seletor de usuário, quando ele é exibido.
  Future<void> bootstrap() async {
    final tenant = tenantId;
    if (!canLinkUser || tenant == null || tenant.isEmpty) return;
    _loadingUsers = true;
    notifyListeners();
    try {
      _users = await _repository.listLinkableUsers(tenant);
      _usersError = null;
    } on AppException catch (e) {
      _usersError = employeeErrorMessage(
        e,
        fallback: 'Não foi possível carregar os usuários.',
      );
    } catch (_) {
      _usersError = 'Não foi possível carregar os usuários.';
    }
    _loadingUsers = false;
    notifyListeners();
  }

  /// Seleciona o usuário vinculado; `null` = sem vínculo (limpa na edição).
  void selectUser(String? userId) {
    _selectedUserId = (userId == null || userId.isEmpty) ? null : userId;
    notifyListeners();
  }

  void setActive(bool value) {
    _active = value;
    notifyListeners();
  }

  /// Persiste o funcionário. Retorna `true` em sucesso.
  Future<bool> save({
    required String name,
    required String email,
    required String document,
    String? position,
  }) async {
    _saving = true;
    _error = null;
    notifyListeners();
    try {
      final current = editing;
      current == null
          ? await _repository.create(
              CreateEmployeeInput(
                name: name,
                email: email,
                document: document,
                position: position,
                userId: canLinkUser ? _selectedUserId : null,
                active: _active,
              ),
            )
          : await _repository.update(
              current.id,
              _updateInput(name, email, document, position),
            );
      _saving = false;
      notifyListeners();
      return true;
    } on AppException catch (e) {
      return _fail(employeeErrorMessage(e, fallback: _saveFallback));
    } catch (_) {
      return _fail(_saveFallback);
    }
  }

  UpdateEmployeeInput _updateInput(
    String name,
    String email,
    String document,
    String? position,
  ) => UpdateEmployeeInput(
    name: name,
    email: email,
    document: document,
    position: ClearableField<String>(position),
    userId: canLinkUser ? ClearableField<String>(_selectedUserId) : null,
    active: _active,
  );

  static const String _saveFallback = 'Não foi possível salvar o funcionário.';

  bool _fail(String message) {
    _error = message;
    _saving = false;
    notifyListeners();
    return false;
  }
}
