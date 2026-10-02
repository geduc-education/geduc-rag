import 'package:flutter_modular/flutter_modular.dart';

import '../../core/auth/app_permissions.dart';
import '../../core/http/api_client.dart';
import '../../core/tenancy/tenant_context.dart';
import '../auth/guards/permission_guard.dart';
import 'data/academic_calendar_repository.dart';
import 'presentation/academic_calendar_page.dart';
import 'presentation/academic_calendars_list_controller.dart';
import 'presentation/calendar_days_controller.dart';

/// Redirect de quem acessa o calendário sem a permissão exigida.
const String _calendarForbiddenRedirect = '/home/dashboard';

/// DI e rotas do Calendário Acadêmico, reancorados no escopo do shell
/// (`/home`) — ver o padrão em `home_module.dart`. A listagem e o calendário
/// aberto são singletons do shell; o formulário vive no diálogo.
void registerAcademicCalendarBinds(ModularContext c) {
  c
    ..addLazySingleton<IAcademicCalendarRepository>(
      () => AcademicCalendarRepository(inject<ApiClient>()),
    )
    ..addLazySingleton<AcademicCalendarsListController>(
      () => AcademicCalendarsListController(
        inject<IAcademicCalendarRepository>(),
        tenants: inject<TenantContext>(),
      ),
    )
    ..addLazySingleton<CalendarDaysController>(
      () => CalendarDaysController(
        inject<IAcademicCalendarRepository>(),
        tenants: inject<TenantContext>(),
      ),
    );
}

/// Rota `/home/academic-calendar`, protegida por `employee:manage` (mesma
/// permissão das rotas do backend) — URL direta não fura o gating do menu.
void registerAcademicCalendarRoutes(ModularContext r) {
  r.route(
    '/academic-calendar',
    guards: [
      permissionGuard(
        AppPermissions.employeeManage,
        redirectTo: _calendarForbiddenRedirect,
      ),
    ],
    child: (context, state) => const AcademicCalendarPage(),
  );
}
