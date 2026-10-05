import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../academic_calendar/data/models/calendar_day_type.dart';
import '../../data/models/schedule_day.dart';
import 'schedule_day_column.dart';

/// Ação sobre um dia (e, se houver, a aula [index]).
typedef DayLessonAction = void Function(ScheduleDay day, int index);

/// Registro de conteúdo/frequência de uma aula do dia.
typedef DayRecordToggle =
    void Function(
      ScheduleDay day,
      int index, {
      bool? content,
      bool? attendance,
    });

/// Grade da semana: 7 colunas, segunda → domingo. A rolagem horizontal fica por
/// fora (barra sempre visível na base da área) e a vertical por dentro; ambas
/// aceitam arrastar com o mouse.
class ScheduleWeekGrid extends StatefulWidget {
  const ScheduleWeekGrid({
    super.key,
    required this.days,
    required this.highlightedDate,
    required this.onAdd,
    required this.onEdit,
    required this.onRemove,
    required this.onToggle,
  });

  final List<ScheduleDay> days;
  final DateTime? highlightedDate;
  final ValueChanged<ScheduleDay> onAdd;
  final DayLessonAction onEdit;
  final DayLessonAction onRemove;
  final DayRecordToggle onToggle;

  @override
  State<ScheduleWeekGrid> createState() => _ScheduleWeekGridState();
}

class _ScheduleWeekGridState extends State<ScheduleWeekGrid> {
  final ScrollController _horizontal = ScrollController();
  final ScrollController _vertical = ScrollController();

  @override
  void dispose() {
    _horizontal.dispose();
    _vertical.dispose();
    super.dispose();
  }

  bool _isHighlighted(ScheduleDay day) {
    final date = widget.highlightedDate;
    return date != null && isSameCalendarDay(date, day.date);
  }

  @override
  Widget build(BuildContext context) {
    return ScrollConfiguration(
      behavior: const _DragScrollBehavior(),
      child: LayoutBuilder(
        builder: (context, constraints) => Scrollbar(
          controller: _horizontal,
          thumbVisibility: true,
          child: SingleChildScrollView(
            controller: _horizontal,
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.only(bottom: AppDimensions.gapMd),
            child: SizedBox(
              height: constraints.maxHeight - AppDimensions.gapMd,
              child: Scrollbar(
                controller: _vertical,
                child: SingleChildScrollView(
                  controller: _vertical,
                  child: _DaysRow(state: this),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Linha com as colunas dos dias.
class _DaysRow extends StatelessWidget {
  const _DaysRow({required this.state});

  final _ScheduleWeekGridState state;

  @override
  Widget build(BuildContext context) {
    final grid = state.widget;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        for (final day in grid.days) ...<Widget>[
          ScheduleDayColumn(
            day: day,
            highlighted: state._isHighlighted(day),
            onAdd: () => grid.onAdd(day),
            onEdit: (i) => grid.onEdit(day, i),
            onRemove: (i) => grid.onRemove(day, i),
            onToggle: (i, {content, attendance}) =>
                grid.onToggle(day, i, content: content, attendance: attendance),
          ),
          AppDimensions.hGapSm,
        ],
      ],
    );
  }
}

/// Permite arrastar a grade com o mouse e o trackpad (no web o padrão é só
/// toque).
class _DragScrollBehavior extends MaterialScrollBehavior {
  const _DragScrollBehavior();

  @override
  Set<PointerDeviceKind> get dragDevices => <PointerDeviceKind>{
    PointerDeviceKind.touch,
    PointerDeviceKind.mouse,
    PointerDeviceKind.trackpad,
    PointerDeviceKind.stylus,
  };
}
