import 'package:flutter/material.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/colors_app.dart';

/// Opção de um [AppMultiSelectChips].
class MultiSelectOption {
  const MultiSelectOption({required this.id, required this.label});
  final String id;
  final String label;
}

/// Seletor múltiplo em chips (toggle). Reflete o RBAC N:N: cada chip é um item
/// selecionável; [selectedIds] é a fonte da verdade e [onToggle] avisa a troca.
///
/// Puramente de apresentação — o estado vive no controller do formulário.
class AppMultiSelectChips extends StatelessWidget {
  const AppMultiSelectChips({
    super.key,
    required this.label,
    required this.options,
    required this.selectedIds,
    required this.onToggle,
    this.emptyHint = 'Nenhuma opção disponível.',
  });

  final String label;
  final List<MultiSelectOption> options;
  final Set<String> selectedIds;
  final ValueChanged<String> onToggle;
  final String emptyHint;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(label, style: context.textStyles.textSmallBold),
        AppDimensions.vGapSm,
        if (options.isEmpty)
          Text(
            emptyHint,
            style: context.textStyles.textSmall.copyWith(
              color: colors.textMuted,
            ),
          )
        else
          Wrap(
            spacing: AppDimensions.gapSm,
            runSpacing: AppDimensions.gapSm,
            children: <Widget>[
              for (final option in options)
                _Chip(
                  label: option.label,
                  selected: selectedIds.contains(option.id),
                  onTap: () => onToggle(option.id),
                ),
            ],
          ),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final bg = selected ? colors.primary : colors.surfaceMuted;
    final fg = selected ? colors.white : colors.textSecondary;
    return InkWell(
      onTap: onTap,
      borderRadius: AppDimensions.borderRadiusPill,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppDimensions.gapMd,
          vertical: AppDimensions.gapSm,
        ),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: AppDimensions.borderRadiusPill,
          border: Border.all(
            color: selected ? colors.primary : colors.borderDefault,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(
              selected ? Icons.check_circle : Icons.circle_outlined,
              size: 16,
              color: fg,
            ),
            AppDimensions.hGapXs,
            Text(
              label,
              style: context.textStyles.textSmallBold.copyWith(color: fg),
            ),
          ],
        ),
      ),
    );
  }
}
