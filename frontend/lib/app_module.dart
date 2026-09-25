import 'package:flutter/widgets.dart';
import 'package:flutter_modular/flutter_modular.dart';

import 'core/core_module.dart';
import 'modules/auth/auth_module.dart';
import 'modules/home/home_module.dart';

/// Módulo raiz do app. Compõe o [coreModule] (serviços globais, path-less =
/// shared DI root-owned) e os módulos [authModule] (`/auth`) e [homeModule]
/// (`/home`).
///
/// A entrada raiz é uma rota cujo guard sempre devolve o destino (na v7 um
/// guard que retorna um path redireciona): o `child` nunca renderiza.
final appModule = createModule(
  register: (c) {
    c
      ..module(coreModule)
      ..module(authModule)
      ..module(homeModule)
      ..route(
        '/',
        guards: [(_) => '/home/dashboard'],
        child: (_, _) => const SizedBox.shrink(),
      );
  },
);
