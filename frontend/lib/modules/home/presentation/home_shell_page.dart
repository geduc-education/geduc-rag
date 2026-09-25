import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_modular/flutter_modular.dart';

import '../../../core/routing/nav_destinations.dart';
import '../../../core/tenancy/tenant_context.dart';
import '../../../core/theme/colors_app.dart';
import '../../../shared/components/layout/app_header.dart';
import '../../../shared/components/layout/app_shell.dart';
import '../../../shared/components/layout/app_sidebar.dart';
import '../../../shared/components/layout/app_sidebar_item.dart';
import '../../../shared/components/layout/app_sidebar_section.dart';
import '../../../shared/components/responsive/breakpoints.dart';
import '../../auth/services/session_service.dart';
import 'home_shell_controller.dart';
import 'widgets/tenant_selector.dart';

/// Shell administrativo autenticado: sidebar (permission-aware) + header (com
/// o seletor de tenant) + `RouterOutlet` para as telas internas.
class HomeShellPage extends StatefulWidget {
  const HomeShellPage({super.key});

  @override
  State<HomeShellPage> createState() => _HomeShellPageState();
}

class _HomeShellPageState extends State<HomeShellPage> {
  late final HomeShellController _controller;

  /// Dirigir a navegação por `_outletKey.currentState?.navigate(...)` mantém a
  /// troca de aba DENTRO do outlet (o shell persiste), em vez de subir ao
  /// delegate raiz — que recriaria a rota `/home` e remontaria o shell.
  final GlobalKey<RouterOutletState> _outletKey =
      GlobalKey<RouterOutletState>();

  /// Chave do `Scaffold` do [AppShell] — fecha o Drawer do mobile ao navegar.
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  /// Outlet estável (`late final`): reconstruído pelo `AnimatedBuilder`, ele
  /// perderia a sub-pilha e remontaria a aba.
  late final Widget _outlet = RouterOutlet(key: _outletKey);

  @override
  void initState() {
    super.initState();
    _controller = inject<HomeShellController>();
    unawaited(_controller.hydratePreferences());
  }

  /// Destino cujo `route` casa [path] por SEGMENTO (match exato ou prefixo
  /// seguido de `/`); vence o mais específico (rota mais longa).
  NavDestination? _activeDestinationFor(String path) {
    NavDestination? active;
    for (final destination in navDestinations) {
      final route = destination.route;
      if (path != route && !path.startsWith('$route/')) continue;
      if (active == null || route.length > active.route.length) {
        active = destination;
      }
    }
    return active;
  }

  void _navigateTo(String route) {
    _outletKey.currentState?.navigate(route);
    final scaffold = _scaffoldKey.currentState;
    if (scaffold != null && scaffold.isDrawerOpen) scaffold.closeDrawer();
  }

  Future<void> _logout() async {
    await inject<SessionService>().logout();
    if (mounted) context.navigate('/auth/login');
  }

  @override
  Widget build(BuildContext context) {
    // Deriva o destaque da rota corrente e se inscreve nas mudanças de rota
    // (back/forward do browser e `outlet.navigate`).
    final active = _activeDestinationFor(context.routeState().uri.path);
    final isMobile = context.breakpoints.isMobile;
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final collapsed = !isMobile && _controller.sidebarCollapsed;
        return AppShell(
          scaffoldKey: _scaffoldKey,
          sidebarCollapsed: collapsed,
          sidebar: _buildSidebar(active, compact: collapsed, mobile: isMobile),
          header: AppHeader(
            leading: const _MenuButton(),
            titleText: active?.label ?? 'GEDUC RAG',
            subtitleText: active?.description,
            actions: <Widget>[TenantSelector(tenants: inject<TenantContext>())],
          ),
          child: _outlet,
        );
      },
    );
  }

  AppSidebar _buildSidebar(
    NavDestination? active, {
    required bool compact,
    required bool mobile,
  }) {
    final layout = _controller.sidebarLayout;
    final entries = <Widget>[
      for (final destination in layout.topLoose) _item(destination, active),
      for (final section in layout.sections)
        AppSidebarSection(
          key: ValueKey(section.group),
          icon: navGroupIcon(section.group),
          label: navGroupLabel(section.group),
          description: navGroupDescription(section.group),
          expandAll: _controller.menuGroupsExpanded,
          selectedChildIndex: _selectedChildIndex(section, active),
          children: <AppSidebarSubItem>[
            for (final destination in section.items)
              AppSidebarSubItem(
                icon: destination.icon,
                label: destination.label,
                description: destination.description,
                onTap: () => _navigateTo(destination.route),
              ),
          ],
        ),
      for (final destination in layout.bottomLoose) _item(destination, active),
    ];
    return AppSidebar(
      entries: entries,
      compact: compact,
      onToggleCollapse: mobile ? null : _controller.toggleSidebarCollapsed,
      allExpanded: _controller.menuGroupsExpanded,
      onToggleExpandAll: _controller.toggleMenuGroupsExpanded,
      user: AppSidebarUserData(
        name: _controller.userName,
        role: _controller.userRole,
        onChangePasswordTap: () => context.navigate('/auth/change-password'),
        onLogoutTap: _logout,
      ),
    );
  }

  Widget _item(NavDestination destination, NavDestination? active) =>
      AppSidebarItem(
        icon: destination.icon,
        label: destination.label,
        description: destination.description,
        selected: active?.route == destination.route,
        onTap: () => _navigateTo(destination.route),
      );

  /// Índice do destino ativo dentro de [section] — gatilho do auto-expand.
  int? _selectedChildIndex(SidebarSection section, NavDestination? active) {
    if (active == null) return null;
    final index = section.items.indexWhere((d) => d.route == active.route);
    return index < 0 ? null : index;
  }
}

/// Botão de abrir o drawer, visível só no breakpoint mobile.
class _MenuButton extends StatelessWidget {
  const _MenuButton();

  @override
  Widget build(BuildContext context) {
    if (!context.breakpoints.isMobile) return const SizedBox.shrink();
    return IconButton(
      tooltip: 'Menu',
      icon: Icon(Icons.menu_rounded, color: context.colors.textPrimary),
      onPressed: () => Scaffold.of(context).openDrawer(),
    );
  }
}
