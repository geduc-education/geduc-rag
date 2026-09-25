import 'package:flutter/foundation.dart';

import 'auth_user.dart';

/// Fonte única das permissões efetivas do usuário logado, para o gating de UI.
///
/// Espelho do `EffectivePermissions` do backend: a permissão é a **união**
/// dos perfis e o SUPERADMIN libera tudo. O frontend **apenas esconde UI** —
/// a autoridade é o backend (guards + regras de alcance nos services).
///
/// É um [ChangeNotifier] para o shell/menu reagir a login/logout sem
/// reconstruir a árvore inteira.
class PermissionService extends ChangeNotifier {
  AuthUser? _user;

  /// Usuário autenticado corrente (`null` = deslogado).
  AuthUser? get user => _user;

  /// Conjunto de permissões efetivas do usuário corrente.
  Set<String> get permissions => _user?.permissions ?? const <String>{};

  bool get isAuthenticated => _user != null;

  /// `true` para o SUPERADMIN — acesso total (espelha o bypass do backend).
  bool get isSuperAdmin => _user?.isSuperAdmin ?? false;

  /// Define/atualiza o usuário logado (login, troca de senha, refresh).
  void setUser(AuthUser? user) {
    _user = user;
    notifyListeners();
  }

  /// Limpa a sessão (logout).
  void clear() => setUser(null);

  /// `true` se o usuário possui a permissão [key] (ou é SUPERADMIN).
  bool can(String key) => isSuperAdmin || permissions.contains(key);

  /// `true` se possui **pelo menos uma** das [keys]. Lista vazia significa
  /// "sem exigência" → sempre visível para logados.
  bool canAny(Iterable<String> keys) {
    final list = keys.toList(growable: false);
    if (list.isEmpty) return true;
    return list.any(can);
  }

  /// `true` se possui **todas** as [keys].
  bool canAll(Iterable<String> keys) => keys.every(can);
}
