import 'package:flutter/material.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/colors_app.dart';
import '../user/app_avatar_initials.dart';

/// Bloco de usuário renderizado no rodapé da `AppSidebar`.
///
/// [onSettingsTap]/[onChangePasswordTap]/[onLogoutTap] são aditivos: quando
/// presentes, o botão do rodapé abre um menu com as entradas correspondentes
/// ("Configurações", "Trocar senha" e "Sair").
class AppSidebarUserData {
  const AppSidebarUserData({
    required this.name,
    required this.role,
    this.onTap,
    this.onSettingsTap,
    this.onChangePasswordTap,
    this.onLogoutTap,
  });

  final String name;
  final String role;
  final VoidCallback? onTap;
  final VoidCallback? onSettingsTap;
  final VoidCallback? onChangePasswordTap;
  final VoidCallback? onLogoutTap;

  bool get hasMenu =>
      onSettingsTap != null ||
      onChangePasswordTap != null ||
      onLogoutTap != null;
}

/// Rodapé de usuário da sidebar. Em [compact] mostra só o avatar (com tooltip
/// do nome); quando há menu, o próprio avatar abre o popup de conta.
class AppSidebarUserFooter extends StatelessWidget {
  const AppSidebarUserFooter({
    super.key,
    required this.data,
    this.compact = false,
  });

  final AppSidebarUserData data;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    if (compact) return _CompactFooter(data: data);
    return _ExpandedFooter(data: data);
  }
}

class _CompactFooter extends StatelessWidget {
  const _CompactFooter({required this.data});
  final AppSidebarUserData data;

  @override
  Widget build(BuildContext context) {
    // Avatar de 36px centralizado num alvo de toque de 48×48 (a11y).
    final Widget avatar = SizedBox.square(
      dimension: AppDimensions.minTouchTarget,
      child: Center(
        child: AppAvatarInitials(name: data.name, size: AppDimensions.avatarSm),
      ),
    );
    final Widget child = data.hasMenu
        ? _UserFooterMenu(data: data, tooltip: data.name, child: avatar)
        : Tooltip(
            message: data.name,
            child: InkWell(
              onTap: data.onTap,
              customBorder: const CircleBorder(),
              child: avatar,
            ),
          );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppDimensions.gapMd),
      child: Center(child: child),
    );
  }
}

class _ExpandedFooter extends StatelessWidget {
  const _ExpandedFooter({required this.data});
  final AppSidebarUserData data;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return InkWell(
      onTap: data.onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppDimensions.sidebarGutter,
          12,
          12,
          16,
        ),
        child: Row(
          children: <Widget>[
            AppAvatarInitials(name: data.name, size: AppDimensions.avatarSm),
            const SizedBox(width: 12),
            Expanded(child: _FooterTexts(data: data)),
            const SizedBox(width: 4),
            if (data.hasMenu)
              _UserFooterMenu(data: data)
            else
              Icon(
                Icons.keyboard_arrow_right_rounded,
                size: 18,
                color: colors.textSecondary,
              ),
          ],
        ),
      ),
    );
  }
}

class _FooterTexts extends StatelessWidget {
  const _FooterTexts({required this.data});
  final AppSidebarUserData data;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Text(
          data.name,
          style: context.textStyles.textRegularBold.copyWith(
            color: colors.textPrimary,
            fontSize: 13,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 2),
        Text(
          data.role,
          style: context.textStyles.textSmall.copyWith(
            color: colors.textSecondary,
            fontSize: 11,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}

/// Menu do rodapé: "Configurações", "Trocar senha" e "Sair".
///
/// Só renderiza entradas cujos callbacks foram fornecidos — o componente
/// compartilhado nunca chama Modular/AuthService direto (o pai injeta).
enum _UserFooterAction { settings, changePassword, logout }

class _UserFooterMenu extends StatelessWidget {
  const _UserFooterMenu({required this.data, this.child, this.tooltip});

  final AppSidebarUserData data;

  /// Gatilho customizado (ex.: avatar no modo compacto). `null` = ícone padrão.
  final Widget? child;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return PopupMenuButton<_UserFooterAction>(
      tooltip: tooltip ?? 'Conta',
      icon: child == null
          ? Icon(Icons.more_vert_rounded, size: 18, color: colors.textSecondary)
          : null,
      color: colors.surfaceCard,
      onSelected: (action) {
        switch (action) {
          case _UserFooterAction.settings:
            data.onSettingsTap?.call();
          case _UserFooterAction.changePassword:
            data.onChangePasswordTap?.call();
          case _UserFooterAction.logout:
            data.onLogoutTap?.call();
        }
      },
      itemBuilder: (context) => <PopupMenuEntry<_UserFooterAction>>[
        if (data.onSettingsTap != null)
          _menuItem(
            context,
            action: _UserFooterAction.settings,
            icon: Icons.settings_outlined,
            label: 'Configurações',
          ),
        if (data.onChangePasswordTap != null)
          _menuItem(
            context,
            action: _UserFooterAction.changePassword,
            icon: Icons.lock_reset_outlined,
            label: 'Trocar senha',
          ),
        if (data.onLogoutTap != null)
          _menuItem(
            context,
            action: _UserFooterAction.logout,
            icon: Icons.logout_rounded,
            label: 'Sair',
            destructive: true,
          ),
      ],
      child: child,
    );
  }

  PopupMenuItem<_UserFooterAction> _menuItem(
    BuildContext context, {
    required _UserFooterAction action,
    required IconData icon,
    required String label,
    bool destructive = false,
  }) {
    final colors = context.colors;
    final color = destructive ? colors.error : colors.textSecondary;
    final textColor = destructive ? colors.error : colors.textPrimary;
    return PopupMenuItem<_UserFooterAction>(
      value: action,
      child: Row(
        children: <Widget>[
          Icon(icon, size: 18, color: color),
          const SizedBox(width: AppDimensions.gapMd),
          Text(
            label,
            style: context.textStyles.textRegular.copyWith(color: textColor),
          ),
        ],
      ),
    );
  }
}
