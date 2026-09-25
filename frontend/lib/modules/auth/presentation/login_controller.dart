import 'package:flutter/foundation.dart';

import '../../../core/auth/auth_user.dart';
import '../../../core/errors/app_exception.dart';
import '../../../core/storage/local_preferences.dart';
import '../services/session_service.dart';

/// Controller da tela de login. Estados: `idle`, `loading`, `error`.
///
/// Não navega — expõe o resultado ([AuthUser]) e o flag [mustChangePassword]
/// para a página decidir o destino (shell vs. troca de senha obrigatória).
///
/// "Lembrar meu e-mail": [bootstrap] lê a preferência e o e-mail salvo; o
/// submit bem-sucedido persiste o e-mail quando o flag está ligado. A senha
/// NUNCA é persistida e qualquer falha de prefs degrada
/// silenciosamente com `debugPrint` — nunca bloqueia o login.
class LoginController extends ChangeNotifier {
  LoginController(this._session, this._preferences);

  final SessionService _session;
  final LocalPreferences _preferences;

  bool _loading = false;
  String? _error;
  bool _rememberEmail = true;
  String? _initialEmail;

  bool get loading => _loading;
  String? get error => _error;

  /// Estado do checkbox "Lembrar meu e-mail" (default MARCADO).
  bool get rememberEmail => _rememberEmail;

  /// E-mail salvo do último login, para a página pré-preencher o campo;
  /// `null` = nenhum salvo (campo fica vazio).
  String? get initialEmail => _initialEmail;

  /// Lê a preferência e o e-mail lembrado. Falha degrada para o comportamento
  /// padrão (checkbox marcado, campo vazio) com log — nunca trava a tela.
  Future<void> bootstrap() async {
    try {
      _rememberEmail = await _preferences.readRememberEmail() ?? true;
      _initialEmail = _rememberEmail
          ? await _preferences.readRememberedEmail()
          : null;
    } catch (error) {
      debugPrint('LoginController: falha ao ler preferências ($error)');
      _rememberEmail = true;
      _initialEmail = null;
    }
    notifyListeners();
  }

  /// Alterna o "lembrar e-mail". Desmarcar apaga o e-mail salvo NA HORA (não
  /// espera o submit); falha de escrita só loga — a UI mantém a escolha.
  Future<void> setRememberEmail(bool value) async {
    if (_rememberEmail == value) return;
    _rememberEmail = value;
    notifyListeners();
    try {
      await _preferences.writeRememberEmail(value);
      if (!value) await _preferences.writeRememberedEmail(null);
    } catch (error) {
      debugPrint('LoginController: falha ao salvar preferência ($error)');
    }
  }

  /// Executa o login. Retorna o usuário autenticado em caso de sucesso ou
  /// `null` em falha (mensagem disponível em [error]).
  Future<AuthUser?> submit(String email, String password) async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final user = await _session.login(email, password);
      await _persistRememberedEmail(email);
      _loading = false;
      notifyListeners();
      return user;
    } on AppException catch (e) {
      _error = _messageFor(e);
      _loading = false;
      notifyListeners();
      return null;
    } catch (_) {
      _error = 'Não foi possível entrar. Tente novamente.';
      _loading = false;
      notifyListeners();
      return null;
    }
  }

  /// Persiste o e-mail após login bem-sucedido (só quando o flag está ligado).
  /// Só o e-mail: a senha nunca chega perto das prefs.
  Future<void> _persistRememberedEmail(String email) async {
    if (!_rememberEmail) return;
    try {
      await _preferences.writeRememberedEmail(email.trim());
    } catch (error) {
      debugPrint('LoginController: falha ao salvar e-mail lembrado ($error)');
    }
  }

  String _messageFor(AppException e) {
    if (e.statusCode == 401) return 'E-mail ou senha inválidos.';
    return e.message;
  }
}
