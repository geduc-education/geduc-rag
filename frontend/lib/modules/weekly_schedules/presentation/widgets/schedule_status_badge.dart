import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/colors_app.dart';
import '../../data/models/weekly_schedule.dart';

/// Selo da situação do horário: atualizado (verde) ou desatualizado
/// (amarelo — o calendário mudou depois de salvar).
class ScheduleStatusBadge extends StatelessWidget {
  const ScheduleStatusBadge({super.key, required this.status});

  final ScheduleStatus status;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final outdated = status == ScheduleStatus.outdated;
    final foreground = outdated ? colors.warning700 : colors.success700;
    return Tooltip(
      message: outdated
          ? 'O calendário acadêmico mudou depois que o horário foi salvo.'
          : 'O horário está de acordo com o calendário acadêmico.',
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppDimensions.gapSm,
          vertical: AppDimensions.gapXs / 2,
        ),
        decoration: BoxDecoration(
          color: outdated ? colors.warning50 : colors.success50,
          borderRadius: AppDimensions.borderRadiusPill,
          border: Border.all(
            color: outdated ? colors.warning100 : colors.success100,
          ),
        ),
        child: Text(
          status.label,
          style: context.textStyles.textVerySmallBold.copyWith(
            color: foreground,
          ),
        ),
      ),
    );
  }
}
