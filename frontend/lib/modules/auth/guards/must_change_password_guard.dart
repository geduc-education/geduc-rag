import 'package:flutter_modular/flutter_modular.dart';

import '../../../core/auth/permission_service.dart';

/// Bloqueia o shell enquanto o 1º acesso não trocar a senha temporária.
///
/// Guard síncrono da v7: quando `mustChangePassword` está ativo, qualquer rota
/// do shell é desviada para a troca de senha (fluxo bloqueante).
String? mustChangePasswordGuard(RouteState state) {
  final user = inject<PermissionService>().user;
  // Sem sessão o authGuard já cuida do redirect; aqui só barramos o 1º acesso.
  if (user == null) return null;
  return user.mustChangePassword ? '/auth/change-password' : null;
}
