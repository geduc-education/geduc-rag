import 'package:flutter_modular/flutter_modular.dart';

import '../../core/auth/app_permissions.dart';
import '../../core/http/api_client.dart';
import '../../core/tenancy/tenant_context.dart';
import '../auth/guards/permission_guard.dart';
import 'data/weekly_schedules_repository.dart';
import 'presentation/weekly_schedule_editor_args.dart';
import 'presentation/weekly_schedule_editor_page.dart';
import 'presentation/weekly_schedules_list_controller.dart';
import 'presentation/weekly_schedules_list_page.dart';

/// Redirect de quem acessa o horário semanal sem a permissão exigida.
const String _schedulesForbiddenRedirect = '/home/dashboard';

/// DI do Horário Semanal, reancorado no escopo do shell (`/home`) — ver o
/// padrão em `home_module.dart`. A listagem é singleton do shell; o editor
/// instancia o próprio controller.
void registerWeeklySchedulesBinds(ModularContext c) {
  c
    ..addLazySingleton<IWeeklySchedulesRepository>(
      () => WeeklySchedulesRepository(inject<ApiClient>()),
    )
    ..addLazySingleton<WeeklySchedulesListController>(
      () => WeeklySchedulesListController(
        inject<IWeeklySchedulesRepository>(),
        tenants: inject<TenantContext>(),
      ),
    );
}

/// Rotas `/home/weekly-schedules` (lista) e `/home/weekly-schedules/editor`,
/// protegidas por `employee:manage` (mesma permissão do backend). Os
/// argumentos do editor chegam como [WeeklyScheduleEditorArgs].
void registerWeeklySchedulesRoutes(ModularContext r) {
  final guards = <ModularGuard>[
    permissionGuard(
      AppPermissions.employeeManage,
      redirectTo: _schedulesForbiddenRedirect,
    ),
  ];
  r
    ..route(
      '/weekly-schedules',
      guards: guards,
      child: (context, state) => const WeeklySchedulesListPage(),
    )
    ..route(
      '/weekly-schedules/editor',
      guards: guards,
      child: (context, state) => WeeklyScheduleEditorPage(
        args: state.arguments is WeeklyScheduleEditorArgs
            ? state.arguments as WeeklyScheduleEditorArgs
            : null,
      ),
    );
}
