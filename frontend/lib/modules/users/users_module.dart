import 'package:flutter_modular/flutter_modular.dart';

import '../../core/http/api_client.dart';
import 'data/models/user_model.dart';
import 'data/users_repository.dart';
import 'presentation/user_form_page.dart';
import 'presentation/users_list_controller.dart';
import 'presentation/users_list_page.dart';

/// DI e rotas de usuários, **reancorados no escopo do shell** (`/home`) — ver
/// o padrão em `home_module.dart`. O usuário em edição chega como
/// `state.arguments` da rota `/users/form`.
void registerUsersBinds(ModularContext c) {
  c
    ..addLazySingleton<IUsersRepository>(
      () => UsersRepository(inject<ApiClient>()),
    )
    ..addLazySingleton<UsersListController>(
      () => UsersListController(inject<IUsersRepository>()),
    );
}

void registerUsersRoutes(ModularContext r) {
  r
    ..route('/users', child: (context, state) => const UsersListPage())
    ..route(
      '/users/form',
      child: (context, state) => UserFormPage(
        user: state.arguments is UserModel
            ? state.arguments as UserModel
            : null,
      ),
    );
}
