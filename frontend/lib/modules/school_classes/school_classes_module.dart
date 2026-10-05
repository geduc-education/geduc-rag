import 'package:flutter_modular/flutter_modular.dart';

import '../../core/auth/app_permissions.dart';
import '../../core/http/api_client.dart';
import '../../core/tenancy/tenant_context.dart';
import '../auth/guards/permission_guard.dart';
import 'data/models/school_class_model.dart';
import 'data/school_classes_repository.dart';
import 'presentation/school_class_form_page.dart';
import 'presentation/school_classes_list_controller.dart';
import 'presentation/school_classes_list_page.dart';

/// Redirect de quem acessa uma rota de turmas sem a permissão exigida.
const String _classesForbiddenRedirect = '/home/dashboard';

/// DI de turmas, **reancorada no escopo do shell** (`/home`) — ver o padrão
/// em `home_module.dart`.
void registerSchoolClassesBinds(ModularContext c) {
  c
    ..addLazySingleton<ISchoolClassesRepository>(
      () => SchoolClassesRepository(inject<ApiClient>()),
    )
    ..addLazySingleton<SchoolClassesListController>(
      () => SchoolClassesListController(
        inject<ISchoolClassesRepository>(),
        tenants: inject<TenantContext>(),
      ),
    );
}

/// Rotas sob `/home/school-classes/...`. O backend exige `employee:manage`
/// inclusive na leitura. A turma em edição chega como `state.arguments` da
/// rota `/school-classes/form`.
void registerSchoolClassesRoutes(ModularContext r) {
  final guards = [
    permissionGuard(
      AppPermissions.employeeManage,
      redirectTo: _classesForbiddenRedirect,
    ),
  ];
  r
    ..route(
      '/school-classes',
      guards: guards,
      child: (context, state) => const SchoolClassesListPage(),
    )
    ..route(
      '/school-classes/form',
      guards: guards,
      child: (context, state) => SchoolClassFormPage(
        schoolClass: state.arguments is SchoolClassModel
            ? state.arguments as SchoolClassModel
            : null,
      ),
    );
}
