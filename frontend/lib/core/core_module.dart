import 'package:flutter_modular/flutter_modular.dart';

import '../modules/auth/data/auth_repository.dart';
import '../modules/auth/services/session_service.dart';
import '../shared/components/feedback/app_toast.dart';
import 'auth/permission_service.dart';
import 'http/api_client.dart';
import 'storage/local_preferences.dart';
import 'storage/secure_storage.dart';
import 'tenancy/tenant_context.dart';

/// Módulo de serviços globais compartilhados (storage, HTTP, sessão,
/// permissões, tenant ativo).
///
/// Módulo **path-less** = shared DI root-owned na v7: binds visíveis em toda a
/// árvore de rotas (guards, `appModule` e submódulos), singletons únicos.
final coreModule = createModule(
  register: (c) {
    c
      ..addSingleton<SecureStorage>(() => SecureStorage())
      ..addSingleton<LocalPreferences>(LocalPreferences.new)
      // Singleton no DI: a `AppToastLayer` do `app_widget` recebe ESTA
      // instância; páginas seguem usando `showAppToast(context, ...)`.
      ..addSingleton<AppToastController>(AppToastController.new)
      ..addSingleton<PermissionService>(PermissionService.new)
      ..addLazySingleton<TenantContext>(
        () => TenantContext(inject<LocalPreferences>()),
      )
      // Lazy: o commit dos `addSingleton` roda antes do `inject` global estar
      // armado; factory que chama `inject` só pode resolver no 1º acesso.
      ..addLazySingleton<ApiClient>(
        () => ApiClient(
          inject<SecureStorage>(),
          tenantIdProvider: () => inject<TenantContext>().activeTenantId,
        ),
      )
      ..addLazySingleton<IAuthRepository>(
        () => AuthRepository(inject<ApiClient>()),
      )
      ..addLazySingleton<SessionService>(
        () => SessionService(
          inject<IAuthRepository>(),
          inject<SecureStorage>(),
          inject<PermissionService>(),
          tenants: inject<TenantContext>(),
        ),
      );
  },
);
