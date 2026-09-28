import 'package:flutter_modular/flutter_modular.dart';

import '../../core/http/api_client.dart';
import 'data/changelog_repository.dart';
import 'presentation/changelog_controller.dart';
import 'presentation/changelog_page.dart';

/// DI e rotas de Novidades, reancorados no escopo do shell (`/home`) — ver o
/// padrão em `home_module.dart`. O controller é singleton do shell, dividido
/// pela página e pelo card da tela de início.
void registerChangelogBinds(ModularContext c) {
  c
    ..addLazySingleton<IChangelogRepository>(
      () => ChangelogRepository(inject<ApiClient>()),
    )
    ..addLazySingleton<ChangelogController>(
      () => ChangelogController(inject<IChangelogRepository>()),
    );
}

void registerChangelogRoutes(ModularContext r) {
  r.route('/changelog', child: (context, state) => const ChangelogPage());
}
