import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/colors_app.dart';
import '../../../../shared/components/buttons/app_primary_button.dart';
import '../../../../shared/utils/app_date_formats.dart';
import '../../data/models/schedule_replication.dart';

const double _kDialogWidth = 520;

/// Resolve o nome da disciplina pelo id (o resumo do backend só traz o id).
typedef SubjectNameOf = String Function(String subjectId);

/// Resumo da replicação: semanas criadas/sobrescritas, aulas preservadas
/// (com registro) e descartadas com o motivo.
class ReplicationSummaryDialog extends StatelessWidget {
  const ReplicationSummaryDialog({
    super.key,
    required this.outcome,
    required this.subjectName,
  });

  final ReplicationOutcome outcome;
  final SubjectNameOf subjectName;

  static Future<void> show(
    BuildContext context, {
    required ReplicationOutcome outcome,
    required SubjectNameOf subjectName,
  }) => showDialog<void>(
    context: context,
    builder: (_) =>
        ReplicationSummaryDialog(outcome: outcome, subjectName: subjectName),
  );

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Replicação concluída'),
      content: SizedBox(
        width: _kDialogWidth,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(
                '${outcome.createdCount} semana(s) criada(s) · '
                '${outcome.overwrittenCount} sobrescrita(s) · '
                '${outcome.preservedCount} aula(s) preservada(s) · '
                '${outcome.discardedCount} descartada(s)',
                style: context.textStyles.textRegularBold,
              ),
              for (final result in outcome.results) ...<Widget>[
                AppDimensions.vGapMd,
                _ResultSection(result: result, subjectName: subjectName),
              ],
            ],
          ),
        ),
      ),
      actions: <Widget>[
        AppPrimaryButton(
          label: 'Fechar',
          onPressed: () => Navigator.of(context).pop(),
        ),
      ],
    );
  }
}

class _ResultSection extends StatelessWidget {
  const _ResultSection({required this.result, required this.subjectName});

  final ReplicationResult result;
  final SubjectNameOf subjectName;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final styles = context.textStyles;
    return Container(
      padding: AppDimensions.paddingMd,
      decoration: BoxDecoration(
        color: colors.surfaceMuted,
        borderRadius: AppDimensions.borderRadius,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            'Semana ${result.schedule.summary.periodLabel} — '
            '${result.action.label}',
            style: styles.textSmallBold,
          ),
          if (result.preserved.isEmpty && result.discarded.isEmpty)
            Text('Todas as aulas foram copiadas.', style: styles.textSmall),
          for (final lesson in result.preserved)
            _LessonLine(
              icon: Icons.lock_outline,
              color: colors.info500,
              text: '${_describe(lesson)} — preservada (com registro)',
            ),
          for (final lesson in result.discarded)
            _LessonLine(
              icon: Icons.remove_circle_outline,
              color: colors.danger500,
              text:
                  '${_describe(lesson)} — descartada: '
                  '${lesson.reason?.label ?? 'motivo não informado'}',
            ),
        ],
      ),
    );
  }

  String _describe(ReplicatedLesson lesson) =>
      '${formatShortDate(lesson.date)} '
      '${lesson.slotName.isEmpty ? '' : '${lesson.slotName} '}'
      '${lesson.startTime}–${lesson.endTime} ${subjectName(lesson.subjectId)}';
}

class _LessonLine extends StatelessWidget {
  const _LessonLine({
    required this.icon,
    required this.color,
    required this.text,
  });

  final IconData icon;
  final Color color;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: AppDimensions.gapXs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(icon, size: AppDimensions.iconSizeXs, color: color),
          AppDimensions.hGapSm,
          Expanded(child: Text(text, style: context.textStyles.textSmall)),
        ],
      ),
    );
  }
}
