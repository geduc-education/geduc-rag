import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../changelog_controller.dart';
import 'changelog_entry_tile.dart';
import 'changelog_type_badge.dart';

/// Seção de um tipo de mudança: cabeçalho com selo e rótulo do grupo e os
/// itens em ordem de merge.
class ChangelogGroupSection extends StatelessWidget {
  const ChangelogGroupSection({super.key, required this.group});

  final ChangelogGroup group;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Row(
          children: <Widget>[
            ChangelogTypeBadge(type: group.type),
            AppDimensions.hGapSm,
            Text(group.label, style: context.textStyles.textTile16),
          ],
        ),
        AppDimensions.vGapMd,
        for (final entry in group.items) ...<Widget>[
          ChangelogEntryTile(entry: entry),
          AppDimensions.vGapSm,
        ],
      ],
    );
  }
}
