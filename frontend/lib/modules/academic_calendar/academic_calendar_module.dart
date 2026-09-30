import 'package:flutter_modular/flutter_modular.dart';

import 'data/academic_calendar_repository.dart';
import 'data/in_memory_academic_calendar_repository.dart';
import 'presentation/academic_calendar_controller.dart';
import 'presentation/academic_calendar_page.dart';

/// DI e rotas do Calendário Acadêmico, reancorados no escopo do shell
/// (`/home`) — ver o padrão em `home_module.dart`.
///
/// O repositório ainda é em memória (não há API de calendário no backend);
/// quando houver, basta trocar a implementação registrada aqui.
void registerAcademicCalendarBinds(ModularContext c) {
  c
    ..addLazySingleton<IAcademicCalendarRepository>(
      () => InMemoryAcademicCalendarRepository(),
    )
    ..addLazySingleton<AcademicCalendarController>(
      () => AcademicCalendarController(inject<IAcademicCalendarRepository>()),
    );
}

void registerAcademicCalendarRoutes(ModularContext r) {
  r.route(
    '/academic-calendar',
    child: (context, state) => const AcademicCalendarPage(),
  );
}
