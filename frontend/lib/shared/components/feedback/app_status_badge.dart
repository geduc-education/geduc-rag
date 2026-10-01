import 'package:flutter/material.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/colors_app.dart';

/// Selo "Ativo"/"Inativo" das listagens de cadastro.
class AppStatusBadge extends StatelessWidget {
  const AppStatusBadge({
    super.key,
    required this.active,
    this.activeLabel = 'Ativo',
    this.inactiveLabel = 'Inativo',
  });

  final bool active;
  final String activeLabel;
  final String inactiveLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppDimensions.gapSm,
        vertical: 2,
      ),
      decoration: BoxDecoration(
        color: active ? colors.success50 : colors.neutral200,
        borderRadius: AppDimensions.borderRadiusPill,
      ),
      child: Text(
        active ? activeLabel : inactiveLabel,
        style: context.textStyles.textVerySmallBold.copyWith(
          color: active ? colors.success700 : colors.neutral600,
        ),
      ),
    );
  }
}
