import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/colors_app.dart';
import '../../data/models/schedule_day.dart';

/// Aula na grade da semana: horário de aula (nome e horas), disciplina, os registros de conteúdo e
/// frequência (toggles, só em aula salva) e editar/remover. Aula registrada
/// aparece travada (cadeado) e não pode ser alterada nem removida.
class ScheduleLessonCard extends StatelessWidget {
  const ScheduleLessonCard({
    super.key,
    required this.lesson,
    required this.onEdit,
    required this.onRemove,
    required this.onToggleContent,
    required this.onToggleAttendance,
  });

  final ScheduleLesson lesson;
  final VoidCallback onEdit;
  final VoidCallback onRemove;

  /// `null` = aula ainda não salva (registro indisponível).
  final ValueChanged<bool>? onToggleContent;
  final ValueChanged<bool>? onToggleAttendance;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final locked = lesson.isRecorded;
    return Container(
      padding: AppDimensions.paddingSm,
      decoration: BoxDecoration(
        color: locked ? colors.surfaceMuted : colors.surfaceCard,
        borderRadius: AppDimensions.borderRadiusSm,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          _LessonHeader(
            lesson: lesson,
            onEdit: locked ? null : onEdit,
            onRemove: locked ? null : onRemove,
          ),
          Wrap(
            spacing: AppDimensions.gapXs,
            runSpacing: AppDimensions.gapXs,
            children: <Widget>[
              _RecordChip(
                label: 'Conteúdo',
                selected: lesson.contentRecorded,
                onChanged: onToggleContent,
              ),
              _RecordChip(
                label: 'Frequência',
                selected: lesson.attendanceRecorded,
                onChanged: onToggleAttendance,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _LessonHeader extends StatelessWidget {
  const _LessonHeader({
    required this.lesson,
    required this.onEdit,
    required this.onRemove,
  });

  final ScheduleLesson lesson;
  final VoidCallback? onEdit;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final locked = lesson.isRecorded;
    return Row(
      children: <Widget>[
        if (locked)
          Tooltip(
            message: 'Aula registrada: não pode ser alterada nem excluída.',
            child: Icon(
              Icons.lock_outline,
              size: AppDimensions.iconSizeXs,
              color: colors.textMuted,
            ),
          ),
        if (locked) AppDimensions.hGapXs,
        Expanded(child: _LessonTitle(lesson: lesson)),
        IconButton(
          tooltip: 'Editar aula',
          iconSize: AppDimensions.iconSizeXs,
          visualDensity: VisualDensity.compact,
          icon: const Icon(Icons.edit_outlined),
          onPressed: onEdit,
        ),
        IconButton(
          tooltip: 'Remover aula',
          iconSize: AppDimensions.iconSizeXs,
          visualDensity: VisualDensity.compact,
          icon: Icon(
            Icons.close,
            color: onRemove == null ? null : colors.danger500,
          ),
          onPressed: onRemove,
        ),
      ],
    );
  }
}

class _LessonTitle extends StatelessWidget {
  const _LessonTitle({required this.lesson});

  final ScheduleLesson lesson;

  @override
  Widget build(BuildContext context) {
    final styles = context.textStyles;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          lesson.slotName.isEmpty
              ? lesson.timeRange
              : '${lesson.slotName} · ${lesson.timeRange}',
          style: styles.textSmallBold,
          overflow: TextOverflow.ellipsis,
        ),
        Text(
          lesson.subjectName.isEmpty ? '—' : lesson.subjectName,
          style: styles.textSmall.copyWith(color: context.colors.textSecondary),
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}

class _RecordChip extends StatelessWidget {
  const _RecordChip({
    required this.label,
    required this.selected,
    required this.onChanged,
  });

  final String label;
  final bool selected;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: onChanged == null
          ? 'Salve o horário para registrar a aula.'
          : (selected ? 'Desmarcar registro de ' : 'Registrar ') +
                label.toLowerCase(),
      child: FilterChip(
        label: Text(label, style: context.textStyles.textVerySmallBold),
        selected: selected,
        visualDensity: VisualDensity.compact,
        onSelected: onChanged,
      ),
    );
  }
}
