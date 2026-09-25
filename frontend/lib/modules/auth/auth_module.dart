import 'package:flutter_modular/flutter_modular.dart';

import '../../core/storage/local_preferences.dart';
import 'presentation/change_password_controller.dart';
import 'presentation/change_password_page.dart';
import 'presentation/login_controller.dart';
import 'presentation/login_page.dart';
import 'services/session_service.dart';

/// Módulo de autenticação: login e troca de senha (obrigatória/voluntária). O
/// repositório e o [SessionService] são globais (`coreModule`); aqui ficam só
/// os controllers de tela e as rotas.
///
/// "Esqueci minha senha" ainda não existe: depende do módulo de e-mail no
/// backend. Até lá, o administrador redefine a senha em Usuários.
final authModule = createModule(
  path: '/auth',
  register: (c) {
    c
      ..add<LoginController>(
        () => LoginController(
          inject<SessionService>(),
          inject<LocalPreferences>(),
        ),
      )
      ..add<ChangePasswordController>(
        () => ChangePasswordController(inject<SessionService>()),
      )
      ..route('/login', child: (context, state) => const LoginPage())
      ..route(
        '/change-password',
        child: (context, state) => const ChangePasswordPage(),
      );
  },
);
