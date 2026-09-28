import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/colors_app.dart';
import '../../data/models/changelog_entry.dart';

/// Ícone de cada tipo de mudança.
const Map<ChangelogType, IconData> changelogTypeIcons = {
  ChangelogType.feat: Icons.auto_awesome_outlined,
  ChangelogType.fix: Icons.build_outlined,
  ChangelogType.refactor: Icons.tune_outlined,
};

/// Rótulo curto de cada tipo de mudança (selo e tooltip).
const Map<ChangelogType, String> changelogTypeShortLabels = {
  ChangelogType.feat: 'Novidade',
  ChangelogType.fix: 'Correção',
  ChangelogType.refactor: 'Melhoria',
};

/// Selo do tipo de mudança: ícone e rótulo curto. Com [compact], só o ícone,
/// com o rótulo no `Tooltip`.
class ChangelogTypeBadge extends StatelessWidget {
  const ChangelogTypeBadge({
    super.key,
    required this.type,
    this.compact = false,
  });

  final ChangelogType type;
  final bool compact;

  ({Color background, Color foreground}) _palette(ColorsApp colors) =>
      switch (type) {
        ChangelogType.feat => (
          background: colors.purple50,
          foreground: colors.purple700,
        ),
        ChangelogType.fix => (
          background: colors.success50,
          foreground: colors.success700,
        ),
        ChangelogType.refactor => (
          background: colors.info50,
          foreground: colors.info700,
        ),
      };

  @override
  Widget build(BuildContext context) {
    final palette = _palette(context.colors);
    final label = changelogTypeShortLabels[type] ?? type.name;
    final icon = Icon(
      changelogTypeIcons[type],
      size: AppDimensions.iconSizeXs,
      color: palette.foreground,
    );
    return Tooltip(
      message: label,
      child: Container(
        padding: compact
            ? AppDimensions.paddingXs
            : const EdgeInsets.symmetric(
                horizontal: AppDimensions.gapSm,
                vertical: AppDimensions.gapXs,
              ),
        decoration: BoxDecoration(
          color: palette.background,
          borderRadius: AppDimensions.borderRadiusPill,
        ),
        child: compact
            ? icon
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  icon,
                  AppDimensions.hGapXs,
                  Text(
                    label,
                    style: context.textStyles.textVerySmallBold.copyWith(
                      color: palette.foreground,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
