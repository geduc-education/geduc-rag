import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/core/theme/app_theme.dart';
import 'package:geduc_rag/modules/academic_calendar/data/in_memory_academic_calendar_repository.dart';
import 'package:geduc_rag/modules/academic_calendar/data/models/calendar_event.dart';
import 'package:geduc_rag/modules/academic_calendar/presentation/widgets/calendar_month_grid.dart';
import 'package:geduc_rag/modules/academic_calendar/presentation/widgets/calendar_month_records.dart';
import 'package:geduc_rag/modules/academic_calendar/presentation/widgets/calendar_panel.dart';
import 'package:geduc_rag/modules/academic_calendar/presentation/widgets/calendar_summary_row.dart';
import 'package:google_fonts/google_fonts.dart';

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  testWidgets('grade, resumo e registros renderizam sem overflow', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1400, 1800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final month = DateTime(2026, 9);
    final events = await InMemoryAcademicCalendarRepository(
      today: month,
    ).listEvents(year: 2026, month: 9);
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: SingleChildScrollView(
            child: Column(
              children: <Widget>[
                CalendarSummaryRow(
                  countOf: (t) => events.where((e) => e.type == t).length,
                ),
                CalendarPanel(
                  title: 'Calendário escolar',
                  child: CalendarMonthGrid(
                    month: month,
                    today: DateTime(2026, 9, 30),
                    eventsOn: (d) =>
                        events.where((e) => e.date.day == d).toList(),
                    onPrevious: () {},
                    onNext: () {},
                  ),
                ),
                CalendarMonthRecords(
                  month: month,
                  events: events,
                  onEdit: (_) {},
                  onDelete: (_) {},
                ),
              ],
            ),
          ),
        ),
      ),
    );
    expect(find.text('SETEMBRO DE 2026'), findsOneWidget);
    expect(find.text('FORMAÇÃO PEDAGÓGICA'), findsOneWidget);
    expect(find.text('ESCOLA • SÁBADO LETIVO'), findsOneWidget);
    expect(find.text('Eventos cadastrados para Setembro.'), findsOneWidget);
    expect(find.text('30'), findsOneWidget);
    expect(
      events.map((e) => e.type).toSet(),
      containsAll(calendarSummaryTypes),
    );
  });
}
