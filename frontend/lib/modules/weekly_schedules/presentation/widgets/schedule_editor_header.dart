import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/colors_app.dart';
import '../../../../shared/components/buttons/app_primary_button.dart';
import '../weekly_schedule_editor_controller.dart';
import 'schedule_status_badge.dart';

/// Cabeçalho do editor: voltar, turma, semana `dd/MM a dd/MM`, situação e
/// "Salvar".
class ScheduleEditorHeader extends StatelessWidget {
  const ScheduleEditorHeader({
    super.key,
    required this.controller,
    required this.classLabel,
    required this.onBack,
    required this.onSave,
  });

  final WeeklyScheduleEditorController controller;
  final String classLabel;
  final VoidCallback onBack;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    final status = controller.status;
    final ready = controller.state == ScheduleEditorState.ready;
    return Row(
      children: <Widget>[
        IconButton(
          tooltip: 'Voltar para a lista',
          icon: const Icon(Icons.arrow_back),
          onPressed: onBack,
        ),
        AppDimensions.hGapSm,
        Expanded(
          child: _EditorTitle(
            title: controller.isNew
                ? 'Novo horário semanal'
                : 'Horário semanal',
            subtitle:
                '${classLabel.isEmpty ? '' : 'Turma $classLabel · '}'
                'Semana de ${controller.periodLabel}',
          ),
        ),
        if (status != null) ...<Widget>[
          ScheduleStatusBadge(status: status),
          AppDimensions.hGapLg,
        ],
        AppPrimaryButton(
          label: 'Salvar',
          icon: Icons.save_outlined,
          loading: controller.saving,
          onPressed: ready ? onSave : null,
        ),
      ],
    );
  }
}

class _EditorTitle extends StatelessWidget {
  const _EditorTitle({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final styles = context.textStyles;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          title,
          style: styles.textTile20.copyWith(color: colors.textPrimary),
        ),
        Text(
          subtitle,
          style: styles.textSmall.copyWith(color: colors.textSecondary),
        ),
      ],
    );
  }
}
