import 'package:flutter_modular/flutter_modular.dart';

import '../../core/auth/app_permissions.dart';
import '../../core/http/api_client.dart';
import '../../core/tenancy/tenant_context.dart';
import '../auth/guards/permission_guard.dart';
import 'data/lesson_slots_repository.dart';
import 'data/models/school_model.dart';
import 'data/schools_repository.dart';
import 'presentation/school_form_page.dart';
import 'presentation/schools_list_controller.dart';
import 'presentation/schools_list_page.dart';

/// Redirect de quem acessa uma rota de escolas sem a permissão exigida.
const String _schoolsForbiddenRedirect = '/home/dashboard';

/// DI de escolas, **reancorada no escopo do shell** (`/home`) — ver o padrão
/// em `home_module.dart`.
void registerSchoolsBinds(ModularContext c) {
  c
    ..addLazySingleton<ISchoolsRepository>(
      () => SchoolsRepository(inject<ApiClient>()),
    )
    ..addLazySingleton<ILessonSlotsRepository>(
      () => LessonSlotsRepository(inject<ApiClient>()),
    )
    ..addLazySingleton<SchoolsListController>(
      () => SchoolsListController(
        inject<ISchoolsRepository>(),
        tenants: inject<TenantContext>(),
      ),
    );
}

/// Rotas sob `/home/schools/...`. O backend exige `employee:manage` inclusive
/// na leitura, então as duas telas usam a mesma chave. A escola em edição
/// chega como `state.arguments` da rota `/schools/form`.
void registerSchoolsRoutes(ModularContext r) {
  final guards = [
    permissionGuard(
      AppPermissions.employeeManage,
      redirectTo: _schoolsForbiddenRedirect,
    ),
  ];
  r
    ..route(
      '/schools',
      guards: guards,
      child: (context, state) => const SchoolsListPage(),
    )
    ..route(
      '/schools/form',
      guards: guards,
      child: (context, state) => SchoolFormPage(
        school: state.arguments is SchoolModel
            ? state.arguments as SchoolModel
            : null,
      ),
    );
}
