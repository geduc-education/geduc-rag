import 'package:flutter_modular/flutter_modular.dart';

import '../../core/auth/permission_service.dart';
import '../../core/storage/local_preferences.dart';
import '../academic_calendar/academic_calendar_module.dart';
import '../auth/guards/auth_guard.dart';
import '../auth/guards/must_change_password_guard.dart';
import '../changelog/changelog_module.dart';
import '../employees/employees_module.dart';
import '../rag_assistant/rag_assistant_module.dart';
import '../school_classes/school_classes_module.dart';
import '../schools/schools_module.dart';
import '../subjects/subjects_module.dart';
import '../users/users_module.dart';
import '../weekly_schedules/weekly_schedules_module.dart';
import 'presentation/dashboard_page.dart';
import 'presentation/home_shell_controller.dart';
import 'presentation/home_shell_page.dart';

/// Módulo do shell autenticado (`/home`).
///
/// Padrão de reancoragem (mesmo do geduc-suporte): os binds de cada aba são
/// registrados AQUI via `registerXBinds(c)` e as rotas declaradas no
/// `children` da rota do shell via `registerXRoutes(r)`. Assim
/// `outlet.navigate('/home/<aba>')` renderiza a página com os binds
/// resolvidos SEM remontar o shell.
///
/// `authGuard` + `mustChangePasswordGuard` protegem a entrada do shell.
final homeModule = createModule(
  path: '/home',
  register: (c) {
    c.addLazySingleton<HomeShellController>(
      () => HomeShellController(
        inject<PermissionService>(),
        preferences: inject<LocalPreferences>(),
      ),
    );
    registerUsersBinds(c);
    registerAcademicCalendarBinds(c);
    registerEmployeesBinds(c);
    registerSchoolsBinds(c);
    registerSubjectsBinds(c);
    registerSchoolClassesBinds(c);
    registerWeeklySchedulesBinds(c);
    registerRagAssistantBinds(c);
    registerChangelogBinds(c);
    c.route(
      '/',
      guards: [authGuard, mustChangePasswordGuard],
      child: (_, _) => const HomeShellPage(),
      children: (r) {
        r.route('/dashboard', child: (_, _) => const DashboardPage());
        registerUsersRoutes(r);
        registerAcademicCalendarRoutes(r);
        registerEmployeesRoutes(r);
        registerSchoolsRoutes(r);
        registerSubjectsRoutes(r);
        registerSchoolClassesRoutes(r);
        registerWeeklySchedulesRoutes(r);
        registerRagAssistantRoutes(r);
        registerChangelogRoutes(r);
      },
    );
  },
);
