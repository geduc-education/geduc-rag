import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/colors_app.dart';
import '../../../../shared/components/feedback/app_toast.dart';
import '../../../../shared/utils/app_date_formats.dart';
import '../../data/models/changelog_entry.dart';
import 'changelog_type_badge.dart';

/// Item de Novidades: selo do tipo, título, escopo, selo "Breaking", data do
/// merge e o `#número`, que abre o PR numa aba nova (ou copia o link).
class ChangelogEntryTile extends StatelessWidget {
  const ChangelogEntryTile({super.key, required this.entry});

  final ChangelogEntry entry;

  Future<void> _openPr(BuildContext context) async {
    var opened = false;
    try {
      opened = await launchUrl(
        Uri.parse(entry.url),
        webOnlyWindowName: '_blank',
      );
    } catch (_) {
      opened = false;
    }
    if (opened) return;
    await Clipboard.setData(ClipboardData(text: entry.url));
    if (!context.mounted) return;
    showAppToast(
      context,
      'Não foi possível abrir o PR; link #${entry.number} copiado.',
      type: AppToastType.warning,
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final styles = context.textStyles;
    return Container(
      padding: AppDimensions.paddingMd,
      decoration: BoxDecoration(
        color: colors.surfaceCard,
        borderRadius: AppDimensions.borderRadius,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Row(
        children: <Widget>[
          ChangelogTypeBadge(type: entry.type, compact: true),
          AppDimensions.hGapMd,
          Expanded(child: _EntryInfo(entry: entry)),
          AppDimensions.hGapMd,
          Text(
            formatDate(entry.mergedAt.toLocal()),
            style: styles.textSmall.copyWith(color: colors.textMuted),
          ),
          AppDimensions.hGapSm,
          TextButton(
            onPressed: () => _openPr(context),
            child: Text('#${entry.number}'),
          ),
        ],
      ),
    );
  }
}

class _EntryInfo extends StatelessWidget {
  const _EntryInfo({required this.entry});

  final ChangelogEntry entry;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final styles = context.textStyles;
    final scope = entry.scope;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(entry.title, style: styles.textRegularBold),
        if ((scope != null && scope.isNotEmpty) || entry.breaking) ...<Widget>[
          AppDimensions.vGapXs,
          Wrap(
            spacing: AppDimensions.gapSm,
            runSpacing: AppDimensions.gapXs,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: <Widget>[
              if (scope != null && scope.isNotEmpty)
                Text(
                  scope,
                  style: styles.textSmall.copyWith(color: colors.textSecondary),
                ),
              if (entry.breaking) const _BreakingBadge(),
            ],
          ),
        ],
      ],
    );
  }
}

class _BreakingBadge extends StatelessWidget {
  const _BreakingBadge();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppDimensions.gapSm,
        vertical: 2,
      ),
      decoration: BoxDecoration(
        color: colors.danger50,
        borderRadius: AppDimensions.borderRadiusPill,
      ),
      child: Text(
        'Breaking',
        style: context.textStyles.textVerySmallBold.copyWith(
          color: colors.danger700,
        ),
      ),
    );
  }
}
