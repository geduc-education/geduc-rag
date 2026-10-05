import 'package:flutter_modular/flutter_modular.dart';

import '../../core/auth/app_permissions.dart';
import '../../core/http/api_client.dart';
import '../../core/tenancy/tenant_context.dart';
import '../auth/guards/permission_guard.dart';
import 'data/models/subject_model.dart';
import 'data/subjects_repository.dart';
import 'presentation/subject_form_page.dart';
import 'presentation/subjects_list_controller.dart';
import 'presentation/subjects_list_page.dart';

/// Redirect de quem acessa uma rota de disciplinas sem a permissão exigida.
const String _subjectsForbiddenRedirect = '/home/dashboard';

/// DI de disciplinas, **reancorada no escopo do shell** (`/home`) — ver o padrão
/// em `home_module.dart`.
void registerSubjectsBinds(ModularContext c) {
  c
    ..addLazySingleton<ISubjectsRepository>(
      () => SubjectsRepository(inject<ApiClient>()),
    )
    ..addLazySingleton<SubjectsListController>(
      () => SubjectsListController(
        inject<ISubjectsRepository>(),
        tenants: inject<TenantContext>(),
      ),
    );
}

/// Rotas sob `/home/subjects/...`. O backend exige `employee:manage` inclusive
/// na leitura, então as duas telas usam a mesma chave. A disciplina em edição
/// chega como `state.arguments` da rota `/subjects/form`.
void registerSubjectsRoutes(ModularContext r) {
  final guards = [
    permissionGuard(
      AppPermissions.employeeManage,
      redirectTo: _subjectsForbiddenRedirect,
    ),
  ];
  r
    ..route(
      '/subjects',
      guards: guards,
      child: (context, state) => const SubjectsListPage(),
    )
    ..route(
      '/subjects/form',
      guards: guards,
      child: (context, state) => SubjectFormPage(
        subject: state.arguments is SubjectModel
            ? state.arguments as SubjectModel
            : null,
      ),
    );
}
