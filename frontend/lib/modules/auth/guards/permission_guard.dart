import 'package:flutter_modular/flutter_modular.dart';

import '../../../core/auth/permission_service.dart';

/// Protege uma rota pela permissão efetiva (união dos perfis). Sem a
/// permissão → redireciona (URL direta não pode furar o gating da UI; o
/// backend continua sendo a autoridade sobre o dado).
///
/// Factory: recebe `permission` + `redirectTo` e devolve um guard síncrono da
/// v7 ([ModularGuard]) — retorna o path de redirect ou `null` para liberar.
ModularGuard permissionGuard(String permission, {required String redirectTo}) =>
    (state) => inject<PermissionService>().can(permission) ? null : redirectTo;
