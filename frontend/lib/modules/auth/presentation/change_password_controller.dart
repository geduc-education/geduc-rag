import 'package:flutter/foundation.dart';

import '../../../core/auth/auth_user.dart';
import '../../../core/errors/app_exception.dart';
import '../services/session_service.dart';

/// Controller da troca de senha obrigatória no 1º acesso. Estados: `idle`,
/// `loading`, `error`. Sucesso devolve o usuário atualizado
/// (`mustChangePassword:false`) para a página liberar o shell.
class ChangePasswordController extends ChangeNotifier {
  ChangePasswordController(this._session);

  final SessionService _session;

  bool _loading = false;
  String? _error;

  bool get loading => _loading;
  String? get error => _error;

  Future<AuthUser?> submit(
    String currentPassword,
    String newPassword,
    String confirmPassword,
  ) async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final user = await _session.changePassword(
        currentPassword,
        newPassword,
        confirmPassword,
      );
      _loading = false;
      notifyListeners();
      return user;
    } on AppException catch (e) {
      _error = _messageFor(e);
      _loading = false;
      notifyListeners();
      return null;
    } catch (_) {
      _error = 'Não foi possível alterar a senha. Tente novamente.';
      _loading = false;
      notifyListeners();
      return null;
    }
  }

  String _messageFor(AppException e) {
    if (e.statusCode == 401 || e.statusCode == 400) {
      return e.message.isNotEmpty ? e.message : 'Senha atual incorreta.';
    }
    return e.message;
  }
}
