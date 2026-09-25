import 'package:flutter_modular/flutter_modular.dart';

import '../../../core/auth/permission_service.dart';

/// Protege rotas autenticadas. Sem sessão → redireciona ao login.
///
/// Guard síncrono da v7: retorna o path de redirect ou `null` para liberar. A
/// rehidratação do token (`GET /auth/me`) roda no boot (main → restore) antes
/// de o router avaliar as guardas, então aqui basta checar o estado em memória.
String? authGuard(RouteState state) =>
    inject<PermissionService>().isAuthenticated ? null : '/auth/login';
