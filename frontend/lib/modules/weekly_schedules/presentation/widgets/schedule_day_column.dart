import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/colors_app.dart';
import '../../../../shared/utils/app_date_formats.dart';
import '../../../academic_calendar/presentation/widgets/calendar_day_type_style.dart';
import '../../data/models/schedule_day.dart';
import 'schedule_lesson_card.dart';

/// Largura de cada coluna de dia na grade da semana.
const double kScheduleDayColumnWidth = 232;

/// Ação sobre a aula [index] do dia.
typedef LessonAction = void Function(int index);

/// Registro de conteúdo/frequência da aula [index].
typedef LessonRecordToggle =
    void Function(int index, {bool? content, bool? attendance});

/// Coluna de um dia da semana: cabeçalho com o tipo do calendário (cores do
/// calendário acadêmico), as aulas e "Adicionar aula" — só em dia letivo.
/// [highlighted] destaca o dia com erro (sábado letivo sem aula).
class ScheduleDayColumn extends StatelessWidget {
  const ScheduleDayColumn({
    super.key,
    required this.day,
    required this.highlighted,
    required this.onAdd,
    required this.onEdit,
    required this.onRemove,
    required this.onToggle,
  });

  final ScheduleDay day;
  final bool highlighted;
  final VoidCallback onAdd;
  final LessonAction onEdit;
  final LessonAction onRemove;
  final LessonRecordToggle onToggle;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      width: kScheduleDayColumnWidth,
      padding: AppDimensions.paddingSm,
      decoration: BoxDecoration(
        color: day.dayType?.tint(context) ?? colors.surfaceMuted,
        borderRadius: AppDimensions.borderRadius,
        border: Border.all(
          color: highlighted ? colors.danger500 : colors.borderSubtle,
          width: highlighted ? 2 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          _DayHeader(day: day),
          AppDimensions.vGapSm,
          for (var i = 0; i < day.lessons.length; i++) ...<Widget>[
            ScheduleLessonCard(
              lesson: day.lessons[i],
              onEdit: () => onEdit(i),
              onRemove: () => onRemove(i),
              onToggleContent: day.lessons[i].id == null
                  ? null
                  : (v) => onToggle(i, content: v),
              onToggleAttendance: day.lessons[i].id == null
                  ? null
                  : (v) => onToggle(i, attendance: v),
            ),
            AppDimensions.vGapXs,
          ],
          _DayFooter(day: day, highlighted: highlighted, onAdd: onAdd),
        ],
      ),
    );
  }
}

class _DayHeader extends StatelessWidget {
  const _DayHeader({required this.day});

  final ScheduleDay day;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final styles = context.textStyles;
    final accent = day.dayType?.accent(context) ?? colors.textMuted;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          '${calendarWeekdayName(day.date)} · ${formatShortDate(day.date)}',
          style: styles.textRegularBold.copyWith(color: colors.textPrimary),
        ),
        Row(
          children: <Widget>[
            Icon(Icons.circle, size: AppDimensions.gapSm, color: accent),
            AppDimensions.hGapXs,
            Flexible(
              child: Text(
                day.typeLabel,
                style: styles.textSmallBold.copyWith(color: accent),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _DayFooter extends StatelessWidget {
  const _DayFooter({
    required this.day,
    required this.highlighted,
    required this.onAdd,
  });

  final ScheduleDay day;
  final bool highlighted;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final styles = context.textStyles;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        if (day.needsLesson)
          Text(
            'Sábado letivo: inclua ao menos uma aula.',
            style: styles.textSmallBold.copyWith(
              color: highlighted ? colors.danger700 : colors.warning700,
            ),
          ),
        if (!day.hasClass && day.lessons.isEmpty)
          Text(
            'Sem aulas: o dia não é letivo.',
            style: styles.textSmall.copyWith(color: colors.textMuted),
          ),
        TextButton.icon(
          onPressed: day.hasClass ? onAdd : null,
          icon: const Icon(Icons.add),
          label: const Text('Adicionar aula'),
        ),
      ],
    );
  }
}
