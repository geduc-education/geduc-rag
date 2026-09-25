import 'package:flutter/material.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/colors_app.dart';
import 'app_sidebar.dart';

/// Linha de navegação usada dentro de [AppSidebar] / [AppSidebarSection].
///
/// Três estados visuais: `default`, hover ([MouseRegion]) e `selected`
/// (superfície azul suave + accent bar deslizando da borda esquerda). A seleção
/// é do chamador — o widget é "burro" de propósito. Dentro de um [AppSidebar]
/// compacto ([AppSidebarCompactScope]), renderiza só o ícone centralizado com
/// [Tooltip] do rótulo.
///
/// No modo expandido o rótulo ocupa uma linha única; a [description], quando
/// presente, vira [Tooltip] no hover (mantém a altura uniforme, sem segunda
/// linha). [depth] controla o peso do rótulo: `0` = topo (mais forte), `1` =
/// subitem (um degrau mais leve).
class AppSidebarItem extends StatefulWidget {
  const AppSidebarItem({
    super.key,
    required this.icon,
    required this.label,
    this.description,
    this.selected = false,
    this.onTap,
    this.trailing,
    this.dense = false,
    this.depth = 0,
  });

  final IconData icon;
  final String label;
  final String? description;
  final bool selected;
  final VoidCallback? onTap;
  final Widget? trailing;
  final bool dense;
  final int depth;

  @override
  State<AppSidebarItem> createState() => _AppSidebarItemState();
}

class _AppSidebarItemState extends State<AppSidebarItem> {
  bool _hovering = false;

  void _setHover(bool value) {
    if (_hovering == value) return;
    setState(() => _hovering = value);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final palette = _resolvePalette(colors);
    final compact = AppSidebarCompactScope.of(context);
    final tile = MouseRegion(
      cursor: widget.onTap != null
          ? SystemMouseCursors.click
          : SystemMouseCursors.basic,
      onEnter: (_) => _setHover(true),
      onExit: (_) => _setHover(false),
      // Fundo SEM animação: com fade, mover o mouse entre itens (ou itens
      // deslizando sob o cursor na expansão de um grupo) deixa um rastro de
      // highlights meio esmaecidos — lido como "piscada". Troca instantânea
      // mantém um único item destacado por vez; a transição de seleção segue
      // animada pela accent bar.
      child: Container(
        decoration: BoxDecoration(
          color: palette.background,
          borderRadius: AppDimensions.borderRadiusCardSidebar,
        ),
        child: ClipRRect(
          borderRadius: AppDimensions.borderRadiusCardSidebar,
          child: Stack(
            children: <Widget>[
              _AccentBar(visible: widget.selected, color: palette.iconColor),
              InkWell(
                onTap: widget.onTap,
                borderRadius: AppDimensions.borderRadiusCardSidebar,
                // O hover já é pintado pelo Container acima; o overlay default
                // do InkWell duplicaria o efeito com outro timing de fade.
                hoverColor: Colors.transparent,
                child: compact
                    ? _CompactBody(item: widget, palette: palette)
                    : _ExpandedBody(item: widget, palette: palette),
              ),
            ],
          ),
        ),
      ),
    );
    // No rail o tooltip do rótulo já é dado pelo _CompactBody; no expandido a
    // descrição vive no hover para manter a linha única e a altura uniforme.
    if (!compact && widget.description != null) {
      return Tooltip(
        message: widget.description!,
        waitDuration: const Duration(milliseconds: 500),
        child: tile,
      );
    }
    return tile;
  }

  _ItemPalette _resolvePalette(ColorsApp colors) {
    if (widget.selected) {
      return _ItemPalette(
        background: colors.info50,
        labelColor: colors.info700,
        descriptionColor: colors.info700.withValues(alpha: 0.75),
        iconColor: colors.info700,
      );
    }
    if (_hovering && widget.onTap != null) {
      return _ItemPalette(
        background: colors.surfaceMuted,
        labelColor: colors.textPrimary,
        descriptionColor: colors.textSecondary,
        iconColor: colors.textSecondary,
      );
    }
    return _ItemPalette(
      background: Colors.transparent,
      labelColor: colors.textPrimary,
      descriptionColor: colors.textSecondary,
      iconColor: colors.textSecondary,
    );
  }
}

/// Corpo do item no modo rail: só o ícone centralizado + tooltip do rótulo.
class _CompactBody extends StatelessWidget {
  const _CompactBody({required this.item, required this.palette});

  final AppSidebarItem item;
  final _ItemPalette palette;

  @override
  Widget build(BuildContext context) {
    final dense = item.dense;
    return Tooltip(
      message: item.label,
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: dense ? 8.0 : 10.0),
        child: Center(
          child: Icon(
            item.icon,
            size: dense ? 16.0 : 18.0,
            color: palette.iconColor,
          ),
        ),
      ),
    );
  }
}

/// Corpo do item no modo expandido: ícone + rótulo em linha única + trailing.
class _ExpandedBody extends StatelessWidget {
  const _ExpandedBody({required this.item, required this.palette});

  final AppSidebarItem item;
  final _ItemPalette palette;

  @override
  Widget build(BuildContext context) {
    final dense = item.dense;
    final verticalPadding = dense ? 8.0 : 10.0;
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: 12, vertical: verticalPadding),
      child: Row(
        children: <Widget>[
          Icon(item.icon, size: dense ? 16.0 : 18.0, color: palette.iconColor),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              item.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: context.textStyles.textRegular.copyWith(
                color: palette.labelColor,
                fontSize: dense ? 13 : 14,
                fontWeight: _weightFor(
                  depth: item.depth,
                  selected: item.selected,
                ),
              ),
            ),
          ),
          if (item.trailing != null) ...<Widget>[
            const SizedBox(width: 8),
            IconTheme(
              data: IconThemeData(color: palette.descriptionColor, size: 18),
              child: item.trailing!,
            ),
          ],
        ],
      ),
    );
  }
}

/// Peso do rótulo à la geduc-painel: forte no topo, um degrau mais leve no
/// subitem; a seleção sobe um degrau em ambos os níveis.
FontWeight _weightFor({required int depth, required bool selected}) {
  if (depth == 0) return selected ? FontWeight.w700 : FontWeight.w500;
  return selected ? FontWeight.w600 : FontWeight.w400;
}

class _ItemPalette {
  const _ItemPalette({
    required this.background,
    required this.labelColor,
    required this.descriptionColor,
    required this.iconColor,
  });
  final Color background;
  final Color labelColor;
  final Color descriptionColor;
  final Color iconColor;
}

/// Barra de 4px que desliza da borda esquerda quando o item está selecionado —
/// affordance extra além do fundo tingido (desenho herdado do geduc-painel).
class _AccentBar extends StatelessWidget {
  const _AccentBar({required this.visible, required this.color});

  final bool visible;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return AnimatedPositioned(
      duration: AppDimensions.motionBase,
      curve: Curves.easeOut,
      left: visible ? 0 : -AppDimensions.sidebarAccentWidth,
      top: 0,
      bottom: 0,
      child: Container(
        width: AppDimensions.sidebarAccentWidth,
        decoration: BoxDecoration(
          color: visible ? color : Colors.transparent,
          borderRadius: const BorderRadius.only(
            topRight: Radius.circular(AppDimensions.sidebarAccentWidth),
            bottomRight: Radius.circular(AppDimensions.sidebarAccentWidth),
          ),
        ),
      ),
    );
  }
}
