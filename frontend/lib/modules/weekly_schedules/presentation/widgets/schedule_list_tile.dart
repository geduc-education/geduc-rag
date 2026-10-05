import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/colors_app.dart';
import '../../../../shared/utils/app_date_formats.dart';
import '../../data/models/weekly_schedule.dart';
import 'schedule_status_badge.dart';

/// Item da listagem de horários: período, turma, situação, data de criação
/// e as ações editar, replicar e excluir.
class ScheduleListTile extends StatelessWidget {
  const ScheduleListTile({
    super.key,
    required this.schedule,
    required this.classLabel,
    required this.onEdit,
    required this.onReplicate,
    required this.onRemove,
  });

  final WeeklyScheduleSummary schedule;
  final String classLabel;
  final VoidCallback onEdit;
  final VoidCallback onReplicate;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final hasRecords = schedule.record.hasRecords;
    return Container(
      padding: AppDimensions.paddingLg,
      decoration: BoxDecoration(
        color: colors.surfaceCard,
        borderRadius: AppDimensions.borderRadius,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Row(
        children: <Widget>[
          Icon(Icons.view_week_outlined, color: colors.primary),
          AppDimensions.hGapMd,
          Expanded(
            child: _ScheduleInfo(schedule: schedule, classLabel: classLabel),
          ),
          IconButton(
            tooltip: 'Editar',
            icon: Icon(Icons.edit_outlined, color: colors.textSecondary),
            onPressed: onEdit,
          ),
          IconButton(
            tooltip: 'Replicar para outras semanas',
            icon: Icon(Icons.copy_all_outlined, color: colors.textSecondary),
            onPressed: onReplicate,
          ),
          IconButton(
            tooltip: hasRecords
                ? 'Há aulas registradas: o horário não pode ser excluído'
                : 'Excluir',
            icon: Icon(
              hasRecords ? Icons.lock_outline : Icons.delete_outline,
              color: hasRecords ? colors.textMuted : colors.danger500,
            ),
            onPressed: hasRecords ? null : onRemove,
          ),
        ],
      ),
    );
  }
}

class _ScheduleInfo extends StatelessWidget {
  const _ScheduleInfo({required this.schedule, required this.classLabel});

  final WeeklyScheduleSummary schedule;
  final String classLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final styles = context.textStyles;
    final created = schedule.createdAt;
    final record = schedule.record;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            Flexible(
              child: Text(
                schedule.periodLabel,
                style: styles.textRegularBold.copyWith(
                  color: colors.textPrimary,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            AppDimensions.hGapSm,
            ScheduleStatusBadge(status: schedule.status),
          ],
        ),
        Text(
          'Turma $classLabel · ${record.lessons} aula(s)',
          style: styles.textSmall,
          overflow: TextOverflow.ellipsis,
        ),
        Text(
          created == null
              ? 'Criado em —'
              : 'Criado em ${formatDateTime(created)}',
          style: styles.textSmall.copyWith(color: colors.textMuted),
        ),
      ],
    );
  }
}
