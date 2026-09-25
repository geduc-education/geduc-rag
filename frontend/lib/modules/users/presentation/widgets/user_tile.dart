import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/colors_app.dart';
import '../../../../shared/components/user/app_avatar_initials.dart';
import '../../data/models/user_model.dart';

/// Item da listagem de usuários. Ações só com [canManage]; inativar/excluir
/// somem para o SUPERADMIN e para o próprio usuário (o backend recusaria).
class UserTile extends StatelessWidget {
  const UserTile({
    super.key,
    required this.user,
    required this.canManage,
    required this.isSelf,
    required this.onEdit,
    required this.onResetPassword,
    required this.onToggle,
    required this.onRemove,
  });

  final UserModel user;
  final bool canManage;
  final bool isSelf;
  final VoidCallback onEdit;
  final VoidCallback onResetPassword;
  final VoidCallback onToggle;
  final VoidCallback onRemove;

  bool get _canDisable => !user.isSuperAdmin && !isSelf;

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
          AppAvatarInitials(name: user.name),
          AppDimensions.hGapMd,
          Expanded(child: _UserInfo(user: user)),
          if (canManage) ..._actions(colors),
        ],
      ),
    );
  }

  List<Widget> _actions(ColorsApp colors) => <Widget>[
    IconButton(
      tooltip: 'Editar',
      icon: Icon(Icons.edit_outlined, color: colors.textSecondary),
      onPressed: onEdit,
    ),
    IconButton(
      tooltip: 'Redefinir senha',
      icon: Icon(Icons.lock_reset_outlined, color: colors.textSecondary),
      onPressed: onResetPassword,
    ),
    if (_canDisable) ...<Widget>[
      IconButton(
        tooltip: user.active ? 'Inativar' : 'Reativar',
        icon: Icon(
          user.active ? Icons.block_outlined : Icons.check_circle_outline,
          color: user.active ? colors.danger500 : colors.success500,
        ),
        onPressed: onToggle,
      ),
      IconButton(
        tooltip: 'Excluir',
        icon: Icon(Icons.delete_outline, color: colors.danger500),
        onPressed: onRemove,
      ),
    ],
  ];
}

class _UserInfo extends StatelessWidget {
  const _UserInfo({required this.user});

  final UserModel user;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final muted = context.textStyles.textSmall.copyWith(
      color: colors.textMuted,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            Flexible(
              child: Text(
                user.name,
                style: context.textStyles.textRegularBold.copyWith(
                  color: colors.textPrimary,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            AppDimensions.hGapSm,
            _StatusBadge(active: user.active),
          ],
        ),
        Text(user.email, style: context.textStyles.textSmall),
        Text('${user.profilesLabel} · ${user.tenantsLabel}', style: muted),
      ],
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.active});

  final bool active;

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
        active ? 'Ativo' : 'Inativo',
        style: context.textStyles.textVerySmallBold.copyWith(
          color: active ? colors.success700 : colors.neutral600,
        ),
      ),
    );
  }
}
