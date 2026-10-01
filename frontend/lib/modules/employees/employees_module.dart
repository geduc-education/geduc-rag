import 'package:flutter_modular/flutter_modular.dart';

import '../../core/auth/app_permissions.dart';
import '../../core/http/api_client.dart';
import '../../core/tenancy/tenant_context.dart';
import '../auth/guards/permission_guard.dart';
import 'data/employees_repository.dart';
import 'data/models/employee_model.dart';
import 'presentation/employee_form_page.dart';
import 'presentation/employees_list_controller.dart';
import 'presentation/employees_list_page.dart';

/// Redirect de quem acessa uma rota de funcionários sem a permissão exigida.
const String _employeesForbiddenRedirect = '/home/dashboard';

/// DI e rotas de funcionários, **reancorados no escopo do shell** (`/home`) —
/// ver o padrão em `home_module.dart`. O funcionário em edição chega como
/// `state.arguments` da rota `/employees/form`.
void registerEmployeesBinds(ModularContext c) {
  c
    ..addLazySingleton<IEmployeesRepository>(
      () => EmployeesRepository(inject<ApiClient>()),
    )
    ..addLazySingleton<EmployeesListController>(
      () => EmployeesListController(
        inject<IEmployeesRepository>(),
        tenants: inject<TenantContext>(),
      ),
    );
}

/// Rotas sob `/home/employees/...`, protegidas pela permissão de cada tela
/// (URL direta não fura o gating do menu).
void registerEmployeesRoutes(ModularContext r) {
  r
    ..route(
      '/employees',
      guards: [
        permissionGuard(
          AppPermissions.employeeRead,
          redirectTo: _employeesForbiddenRedirect,
        ),
      ],
      child: (context, state) => const EmployeesListPage(),
    )
    ..route(
      '/employees/form',
      guards: [
        permissionGuard(
          AppPermissions.employeeManage,
          redirectTo: _employeesForbiddenRedirect,
        ),
      ],
      child: (context, state) => EmployeeFormPage(
        employee: state.arguments is EmployeeModel
            ? state.arguments as EmployeeModel
            : null,
      ),
    );
}
