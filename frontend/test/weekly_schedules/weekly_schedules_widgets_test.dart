import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/core/theme/app_theme.dart';
import 'package:geduc_rag/modules/academic_calendar/data/models/calendar_day_type.dart';
import 'package:geduc_rag/modules/weekly_schedules/data/models/schedule_day.dart';
import 'package:geduc_rag/modules/weekly_schedules/data/models/schedule_lookups.dart';
import 'package:geduc_rag/modules/weekly_schedules/presentation/schedule_lesson_rules.dart';
import 'package:geduc_rag/modules/weekly_schedules/presentation/widgets/lesson_form_dialog.dart';
import 'package:geduc_rag/modules/weekly_schedules/presentation/widgets/schedule_week_grid.dart';
import 'package:geduc_rag/shared/components/buttons/app_primary_button.dart';
import 'package:google_fonts/google_fonts.dart';

import '../support/fake_weekly_schedules_repository.dart';

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  testWidgets('grade mostra tipos, aula travada e destaque do sábado', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1800, 1200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final monday = DateTime(2026, 9, 28);
    final days = fakeScheduleWeek(
      monday,
      saturday: CalendarDayType.schoolDay,
    ).toList();
    days[0] = days[0].withLessons(const <ScheduleLesson>[
      ScheduleLesson(
        id: 'l1',
        lessonSlotId: 'slot1',
        slotName: '1ª aula',
        subjectId: 's1',
        subjectName: 'Matemática',
        startTime: '08:00',
        endTime: '08:50',
        contentRecorded: true,
      ),
    ]);
    final added = <DateTime>[];
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: ScheduleWeekGrid(
            days: days,
            highlightedDate: DateTime(2026, 10, 3),
            onAdd: (day) => added.add(day.date),
            onEdit: (_, _) {},
            onRemove: (_, _) {},
            onToggle: (_, _, {content, attendance}) {},
          ),
        ),
      ),
    );
    expect(tester.takeException(), isNull);
    expect(find.text('Matemática'), findsOneWidget);
    expect(find.text('1ª aula · 08:00–08:50'), findsOneWidget);
    expect(find.byIcon(Icons.lock_outline), findsOneWidget);
    expect(
      find.text('Sábado letivo: inclua ao menos uma aula.'),
      findsOneWidget,
    );
    expect(find.text('Dia não letivo'), findsOneWidget);

    final buttons = find.widgetWithText(TextButton, 'Adicionar aula');
    expect(buttons, findsNWidgets(7));
    await tester.tap(buttons.last); // domingo: desabilitado
    await tester.tap(buttons.first);
    expect(added, <DateTime>[monday]);
  });

  Future<void> pumpDialog(
    WidgetTester tester,
    List<ScheduleLessonSlot> slots,
  ) async {
    final day = fakeScheduleWeek(DateTime(2026, 9, 28)).first;
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: LessonFormDialog(
            day: day,
            subjects: const <ScheduleSubject>[
              ScheduleSubject(id: 's1', name: 'Matemática'),
            ],
            slots: slots,
            usedSlotIds: const <String>{'p1'},
            onSubmit: (_) => null,
          ),
        ),
      ),
    );
  }

  testWidgets('diálogo sem horários avisa e não deixa aplicar', (tester) async {
    await pumpDialog(tester, const <ScheduleLessonSlot>[]);
    expect(find.text(noLessonSlotsMessage), findsOneWidget);
    final apply = tester.widget<AppPrimaryButton>(
      find.byType(AppPrimaryButton),
    );
    expect(apply.onPressed, isNull);
  });

  testWidgets('diálogo lista horários e desabilita o ocupado', (tester) async {
    await pumpDialog(tester, const <ScheduleLessonSlot>[
      ScheduleLessonSlot(
        id: 'p1',
        name: '1ª aula',
        startTime: '07:00',
        endTime: '07:50',
      ),
      ScheduleLessonSlot(
        id: 'p2',
        name: '2ª aula',
        startTime: '07:50',
        endTime: '08:40',
      ),
    ]);
    expect(find.text(noLessonSlotsMessage), findsNothing);
    await tester.tap(find.byType(DropdownButtonFormField<String>).first);
    await tester.pumpAndSettle();
    final items = tester
        .widgetList<DropdownMenuItem<String>>(
          find.byType(DropdownMenuItem<String>),
        )
        .where((i) => i.value == 'p1' || i.value == 'p2');
    final enabled = <String?, bool>{for (final i in items) i.value: i.enabled};
    expect(enabled, <String?, bool>{'p1': false, 'p2': true});
    expect(find.text('2ª aula · 07:50–08:40'), findsWidgets);
  });
}
