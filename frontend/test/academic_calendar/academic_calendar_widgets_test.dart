import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/core/theme/app_theme.dart';
import 'package:geduc_rag/modules/academic_calendar/data/models/academic_calendar.dart';
import 'package:geduc_rag/modules/academic_calendar/data/models/calendar_day.dart';
import 'package:geduc_rag/modules/academic_calendar/data/models/calendar_day_type.dart';
import 'package:geduc_rag/modules/academic_calendar/presentation/calendar_days_controller.dart';
import 'package:geduc_rag/modules/academic_calendar/presentation/widgets/calendar_day_form_dialog.dart';
import 'package:geduc_rag/modules/academic_calendar/presentation/widgets/calendar_viewer.dart';
import 'package:google_fonts/google_fonts.dart';

import '../support/fake_academic_calendar_repository.dart';

final AcademicCalendar _calendar = AcademicCalendar(
  id: 'c1',
  year: 2026,
  name: 'Calendário 2026',
  startDate: DateTime(2026, 2, 2),
  endDate: DateTime(2026, 12, 18),
);

Widget _app(Widget child) => MaterialApp(
  theme: AppTheme.light,
  home: Scaffold(body: SingleChildScrollView(child: child)),
);

void _desktop(WidgetTester tester) {
  tester.view.physicalSize = const Size(1400, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  testWidgets('visões mês e ano renderizam com totals e sem overflow', (
    tester,
  ) async {
    _desktop(tester);
    final controller = CalendarDaysController(
      FakeAcademicCalendarRepository(calendars: <AcademicCalendar>[_calendar]),
      clock: () => DateTime(2026, 9, 30),
    );
    await controller.open(_calendar);
    await tester.pumpWidget(
      _app(
        AnimatedBuilder(
          animation: controller,
          builder: (_, _) => CalendarViewer(
            controller: controller,
            onEditDay: (_) {},
            today: DateTime(2026, 9, 30),
          ),
        ),
      ),
    );
    expect(find.text('SETEMBRO DE 2026'), findsOneWidget);
    expect(find.text('FORMAÇÃO PEDAGÓGICA'), findsOneWidget);
    // Card "Dia letivo" (22) + célula do dia 22.
    expect(find.text('22'), findsNWidgets(2));
    expect(find.text('DIA LETIVO'), findsNWidgets(23));

    await tester.tap(find.text('Ano'));
    await tester.pumpAndSettle();
    expect(find.text('DEZEMBRO'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('domingo trava o tipo e mantém a descrição editável', (
    tester,
  ) async {
    CalendarDayUpdate? sent;
    await tester.pumpWidget(
      _app(
        CalendarDayFormDialog(
          day: CalendarDay(
            date: DateTime(2026, 9, 6),
            weekday: 0,
            type: CalendarDayType.nonSchoolDay,
          ),
          onSubmit: (u) async {
            sent = u;
            return null;
          },
        ),
      ),
    );
    expect(find.textContaining('Domingo é sempre dia não letivo'), findsOne);
    await tester.enterText(find.byType(TextFormField), 'Feriado');
    await tester.tap(find.text('Salvar'));
    await tester.pumpAndSettle();
    expect(sent?.toJson(), <String, dynamic>{'description': 'Feriado'});
  });
}
