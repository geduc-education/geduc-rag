import 'package:flutter/material.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/colors_app.dart';
import '../responsive/breakpoints.dart';
import 'app_sidebar.dart';

/// Primitivo de layout que orquestra sidebar + header + conteúdo central.
///
/// Três modos responsivos guiados por `context.breakpoints`:
/// - **desktop** (>=1024): sidebar fixa à esquerda.
/// - **tablet** (600..1024): mesma sidebar, mais estreita (rail).
/// - **mobile** (<600): sidebar vive no `Drawer`; um botão de menu é injetado
///   no [header] pelo consumidor.
///
/// Nos layouts fixos, [sidebarCollapsed] anima a largura entre a expandida e o
/// rail ([railSidebarWidth]) — o conteúdo interno já deve estar no modo
/// `compact` correspondente (o consumidor constrói a [AppSidebar] coerente).
class AppShell extends StatelessWidget {
  const AppShell({
    super.key,
    required this.sidebar,
    required this.header,
    required this.child,
    this.floatingAction,
    this.desktopSidebarWidth = 264,
    this.tabletSidebarWidth = 220,
    this.railSidebarWidth = AppDimensions.sidebarRailWidth,
    this.sidebarCollapsed = false,
    this.scaffoldKey,
  });

  final AppSidebar sidebar;
  final Widget header;
  final Widget child;
  final Widget? floatingAction;
  final double desktopSidebarWidth;
  final double tabletSidebarWidth;
  final double railSidebarWidth;

  /// Sidebar encolhida (rail) nos layouts fixos; ignorado no mobile (Drawer).
  final bool sidebarCollapsed;

  /// Chave do `Scaffold` interno — permite ao consumidor fechar o Drawer no
  /// mobile após navegar (ex.: `scaffoldKey.currentState?.closeDrawer()`).
  final GlobalKey<ScaffoldState>? scaffoldKey;

  @override
  Widget build(BuildContext context) {
    final bucket = context.breakpoints.value;
    switch (bucket) {
      case AppBreakpoint.mobile:
        return _MobileLayout(
          scaffoldKey: scaffoldKey,
          sidebar: sidebar,
          header: header,
          floatingAction: floatingAction,
          child: child,
        );
      case AppBreakpoint.tablet:
        return _FixedLayout(
          scaffoldKey: scaffoldKey,
          sidebar: sidebar,
          header: header,
          sidebarWidth: sidebarCollapsed
              ? railSidebarWidth
              : tabletSidebarWidth,
          floatingAction: floatingAction,
          child: child,
        );
      case AppBreakpoint.desktop:
        return _FixedLayout(
          scaffoldKey: scaffoldKey,
          sidebar: sidebar,
          header: header,
          sidebarWidth: sidebarCollapsed
              ? railSidebarWidth
              : desktopSidebarWidth,
          floatingAction: floatingAction,
          child: child,
        );
    }
  }
}

class _FixedLayout extends StatelessWidget {
  const _FixedLayout({
    required this.sidebar,
    required this.header,
    required this.child,
    required this.sidebarWidth,
    this.floatingAction,
    this.scaffoldKey,
  });

  final AppSidebar sidebar;
  final Widget header;
  final Widget child;
  final double sidebarWidth;
  final Widget? floatingAction;
  final GlobalKey<ScaffoldState>? scaffoldKey;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Scaffold(
      key: scaffoldKey,
      backgroundColor: colors.surfaceMuted,
      floatingActionButton: floatingAction,
      body: Padding(
        padding: AppDimensions.paddingLg,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: colors.surfaceCanvas,
            borderRadius: AppDimensions.radiusScreen,
            boxShadow: AppDimensions.shadowSm,
          ),
          child: ClipRRect(
            borderRadius: AppDimensions.radiusScreen,
            child: Row(
              children: <Widget>[
                _AnimatedSidebarSlot(width: sidebarWidth, sidebar: sidebar),
                Expanded(
                  child: Column(
                    children: <Widget>[
                      header,
                      Expanded(child: child),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Janela animada da sidebar nos layouts fixos.
///
/// O `AnimatedContainer` anima a largura visível; o `OverflowBox` congela o
/// layout interno na largura ALVO (troca instantânea junto do `compact`),
/// então nenhum `Row` interno é medido em larguras intermediárias — sem
/// overflow durante a animação. O `ClipRect` corta o excedente na transição.
class _AnimatedSidebarSlot extends StatelessWidget {
  const _AnimatedSidebarSlot({required this.width, required this.sidebar});

  final double width;
  final AppSidebar sidebar;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: AppDimensions.motionBase,
      curve: Curves.easeInOut,
      width: width,
      child: ClipRect(
        child: OverflowBox(
          alignment: Alignment.centerLeft,
          minWidth: width,
          maxWidth: width,
          child: sidebar,
        ),
      ),
    );
  }
}

class _MobileLayout extends StatelessWidget {
  const _MobileLayout({
    required this.sidebar,
    required this.header,
    required this.child,
    this.floatingAction,
    this.scaffoldKey,
  });

  final AppSidebar sidebar;
  final Widget header;
  final Widget child;
  final Widget? floatingAction;
  final GlobalKey<ScaffoldState>? scaffoldKey;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Scaffold(
      key: scaffoldKey,
      backgroundColor: colors.surfaceCanvas,
      drawer: Drawer(backgroundColor: colors.surfaceCard, child: sidebar),
      floatingActionButton: floatingAction,
      // O botão de abrir o drawer é injetado pelo header via o slot `leading`.
      body: Column(
        children: <Widget>[
          header,
          Expanded(child: child),
        ],
      ),
    );
  }
}
