import 'package:flutter/material.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/colors_app.dart';
import '../app_logo_widget.dart';
import '../dividers/app_divider.dart';
import 'app_header.dart';
import 'app_sidebar_footer.dart';

export 'app_sidebar_footer.dart' show AppSidebarUserData;

/// Propaga o modo compacto (rail) do [AppSidebar] às entradas livres
/// ([AppSidebarItem], rótulos de seção) sem acoplar cada item ao shell.
class AppSidebarCompactScope extends InheritedWidget {
  const AppSidebarCompactScope({
    super.key,
    required this.compact,
    required super.child,
  });

  final bool compact;

  /// `false` fora de um [AppSidebar] (uso avulso das entradas em testes).
  static bool of(BuildContext context) =>
      context
          .dependOnInheritedWidgetOfExactType<AppSidebarCompactScope>()
          ?.compact ??
      false;

  @override
  bool updateShouldNotify(AppSidebarCompactScope oldWidget) =>
      compact != oldWidget.compact;
}

/// Divisor sutil que substitui rótulos/headers de seção no rail (sidebar
/// compacta), onde o texto não cabe — preserva o agrupamento visual.
class AppSidebarRailDivider extends StatelessWidget {
  const AppSidebarRailDivider({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(
        horizontal: AppDimensions.gapMd,
        vertical: AppDimensions.gapSm,
      ),
      child: AppDivider(),
    );
  }
}

/// Superfície de navegação de topo.
///
/// Stateless: scroll e seleção pertencem ao pai (o shell/controller).
/// Composição: `logo → divisor → entradas (scroll) → toggle → divisor →
/// usuário`. Em [compact] (rail) as entradas mostram só ícones com tooltip.
class AppSidebar extends StatelessWidget {
  const AppSidebar({
    super.key,
    required this.entries,
    required this.user,
    this.width = 264,
    this.compact = false,
    this.logoHeight = 40,
    this.onToggleCollapse,
    this.allExpanded = false,
    this.onToggleExpandAll,
  });

  /// Lista livre de entradas (tipicamente [AppSidebarItem]/[AppSidebarSection]).
  final List<Widget> entries;

  /// Bloco de rodapé (avatar + nome + papel + menu).
  final AppSidebarUserData user;

  /// Largura da sidebar (px lógicos).
  final double width;

  /// Modo compacto (rail) esconde textos auxiliares e reduz paddings.
  final bool compact;

  /// Altura do logo (px lógicos).
  final double logoHeight;

  /// Encolher/expandir acionado pelo botão na base da lista. `null` esconde o
  /// botão (ex.: Drawer no mobile, onde o colapso não se aplica).
  final VoidCallback? onToggleCollapse;

  /// Estado do toggle "expandir/recolher tudo" dos grupos ([AppSidebarSection]).
  final bool allExpanded;

  /// Abre/fecha todos os grupos de uma vez. `null` esconde o toggle; no rail
  /// ([compact]) ele some — não há expansão a 72px.
  final VoidCallback? onToggleExpandAll;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      width: width,
      decoration: BoxDecoration(
        color: colors.surfaceCard,
        border: Border(right: BorderSide(color: colors.borderSubtle)),
      ),
      child: SafeArea(
        right: false,
        child: AppSidebarCompactScope(
          compact: compact,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              _Logo(height: logoHeight, compact: compact),
              const AppDivider(),
              if (onToggleExpandAll != null && !compact)
                _ExpandAllToggle(
                  allExpanded: allExpanded,
                  onTap: onToggleExpandAll!,
                ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppDimensions.sidebarMenuInset,
                    vertical: 16,
                  ),
                  children: <Widget>[
                    for (final entry in entries)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: entry,
                      ),
                  ],
                ),
              ),
              if (onToggleCollapse != null)
                _CollapseToggle(compact: compact, onTap: onToggleCollapse!),
              const AppDivider(),
              AppSidebarUserFooter(data: user, compact: compact),
            ],
          ),
        ),
      ),
    );
  }
}

class _Logo extends StatelessWidget {
  const _Logo({required this.height, this.compact = false});
  final double height;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    // Box travado na altura do header para que o divisor logo abaixo case
    // com a borda inferior do header (mesma linha horizontal).
    return SizedBox(
      height: kAppHeaderHeight,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppDimensions.sidebarGutter,
        ),
        child: Align(
          alignment: compact ? Alignment.center : Alignment.centerLeft,
          child: AppLogoWidget(height: height, useMark: compact),
        ),
      ),
    );
  }
}

/// Divisor com o toggle "expandir/recolher tudo" dos grupos, na cabeça da
/// lista de navegação (desenho herdado do geduc-painel).
class _ExpandAllToggle extends StatelessWidget {
  const _ExpandAllToggle({required this.allExpanded, required this.onTap});

  final bool allExpanded;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppDimensions.gapMd,
        AppDimensions.gapXs,
        AppDimensions.gapXs,
        0,
      ),
      child: Row(
        children: <Widget>[
          const Expanded(child: AppDivider()),
          AppDimensions.hGapXs,
          IconButton(
            tooltip: allExpanded ? 'Recolher tudo' : 'Expandir tudo',
            onPressed: onTap,
            visualDensity: VisualDensity.compact,
            icon: Icon(
              allExpanded
                  ? Icons.unfold_less_rounded
                  : Icons.unfold_more_rounded,
              size: AppDimensions.iconSizeXs,
              color: context.colors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

/// Botão de encolher/expandir na base da lista de navegação.
class _CollapseToggle extends StatelessWidget {
  const _CollapseToggle({required this.compact, required this.onTap});

  final bool compact;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppDimensions.sidebarMenuInset,
        vertical: AppDimensions.gapXs,
      ),
      child: Align(
        alignment: compact ? Alignment.center : Alignment.centerRight,
        child: IconButton(
          tooltip: compact ? 'Expandir menu' : 'Recolher menu',
          onPressed: onTap,
          icon: Icon(
            compact
                ? Icons.keyboard_double_arrow_right_rounded
                : Icons.keyboard_double_arrow_left_rounded,
            size: 18,
            color: colors.textSecondary,
          ),
        ),
      ),
    );
  }
}
