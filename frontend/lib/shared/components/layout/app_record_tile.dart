import 'package:flutter/material.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/colors_app.dart';
import '../feedback/app_status_badge.dart';

/// Item padrão das listagens de cadastro simples (escolas, disciplinas,
/// turmas): ícone, título + status e subtítulo opcional. As ações editar e
/// excluir só aparecem quando o callback correspondente é informado.
class AppRecordTile extends StatelessWidget {
  const AppRecordTile({
    super.key,
    required this.title,
    required this.icon,
    required this.active,
    this.subtitle,
    this.onEdit,
    this.onRemove,
  });

  final String title;
  final IconData icon;
  final bool active;
  final String? subtitle;
  final VoidCallback? onEdit;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: AppDimensions.paddingLg,
      decoration: BoxDecoration(
        color: colors.surfaceCard,
        borderRadius: AppDimensions.borderRadius,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Row(
        children: <Widget>[
          _RecordIcon(icon: icon),
          AppDimensions.hGapMd,
          Expanded(
            child: _RecordInfo(
              title: title,
              subtitle: subtitle,
              active: active,
            ),
          ),
          if (onEdit != null)
            IconButton(
              tooltip: 'Editar',
              icon: Icon(Icons.edit_outlined, color: colors.textSecondary),
              onPressed: onEdit,
            ),
          if (onRemove != null)
            IconButton(
              tooltip: 'Excluir',
              icon: Icon(Icons.delete_outline, color: colors.danger500),
              onPressed: onRemove,
            ),
        ],
      ),
    );
  }
}

class _RecordIcon extends StatelessWidget {
  const _RecordIcon({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      width: AppDimensions.avatarSm,
      height: AppDimensions.avatarSm,
      decoration: BoxDecoration(
        color: colors.info50,
        borderRadius: AppDimensions.borderRadiusSm,
      ),
      child: Icon(icon, size: AppDimensions.iconSizeMd, color: colors.info700),
    );
  }
}

class _RecordInfo extends StatelessWidget {
  const _RecordInfo({
    required this.title,
    required this.subtitle,
    required this.active,
  });

  final String title;
  final String? subtitle;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final text = subtitle;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            Flexible(
              child: Text(
                title,
                style: context.textStyles.textRegularBold.copyWith(
                  color: colors.textPrimary,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            AppDimensions.hGapSm,
            AppStatusBadge(active: active),
          ],
        ),
        if (text != null && text.isNotEmpty)
          Text(
            text,
            style: context.textStyles.textSmall.copyWith(
              color: colors.textMuted,
            ),
            overflow: TextOverflow.ellipsis,
          ),
      ],
    );
  }
}
