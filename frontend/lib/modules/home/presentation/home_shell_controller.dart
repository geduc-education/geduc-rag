import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../core/auth/permission_service.dart';
import '../../../core/routing/nav_destinations.dart';
import '../../../core/storage/local_preferences.dart';

/// Controller do shell administrativo.
///
/// Lê as permissões efetivas do [PermissionService] e poda o catálogo de
/// destinos ([navDestinations]) por visibilidade. O **destaque** do menu NÃO
/// vive aqui: é derivado da rota corrente na página (reativo a back/forward do
/// browser e à navegação do outlet), evitando estado duplicado que desincronize
/// quando o shell persiste. A página reconstrói a parte reativa com
/// `AnimatedBuilder` (login/logout re-podam o menu via [notifyListeners]).
class HomeShellController extends ChangeNotifier {
  HomeShellController(this._permissions, {LocalPreferences? preferences})
    : _prefs = preferences ?? LocalPreferences() {
    _permissions.addListener(_onPermissionsChanged);
  }

  final PermissionService _permissions;
  final LocalPreferences _prefs;

  bool _sidebarCollapsed = false;

  /// O usuário já alternou o colapso nesta sessão? Guarda contra a corrida
  /// hidratação×toggle: uma leitura tardia das preferências não pode
  /// sobrescrever a escolha recém-feita.
  bool _sidebarToggledByUser = false;

  /// Sidebar encolhida (rail) nos layouts fixos. Não se aplica ao Drawer do
  /// mobile — a página ignora o flag nesse breakpoint.
  bool get sidebarCollapsed => _sidebarCollapsed;

  /// Hidrata as preferências locais do shell. Silencioso em falha
  /// (ex.: `SharedPreferences` indisponível em teste de widget).
  Future<void> hydratePreferences() async {
    try {
      final collapsed = await _prefs.readSidebarCollapsed();
      // Checagem PÓS-await: se o usuário interagiu enquanto a leitura estava
      // pendente, a escolha dele vence (a persistência já reflete o toggle).
      if (_sidebarToggledByUser) return;
      if (collapsed == null || collapsed == _sidebarCollapsed) return;
      _sidebarCollapsed = collapsed;
      notifyListeners();
    } catch (_) {
      // Preferências indisponíveis: mantém o default expandido em memória.
    }
  }

  void toggleSidebarCollapsed() {
    _sidebarToggledByUser = true;
    _sidebarCollapsed = !_sidebarCollapsed;
    notifyListeners();
    // fire-and-forget: captura a rejeição para não vazar unhandled rejection.
    unawaited(
      _prefs.writeSidebarCollapsed(_sidebarCollapsed).catchError(_ignore),
    );
  }

  /// Descarta falhas de persistência (preferência não crítica).
  static void _ignore(Object error, StackTrace stackTrace) {}

  bool _menuGroupsExpanded = false;

  /// Toggle "expandir/recolher tudo" dos grupos do menu. Efêmero por sessão —
  /// diferente do colapso do rail, não é persistido; o auto-expand do grupo da
  /// rota ativa é local ao widget.
  bool get menuGroupsExpanded => _menuGroupsExpanded;

  void toggleMenuGroupsExpanded() {
    _menuGroupsExpanded = !_menuGroupsExpanded;
    notifyListeners();
  }

  /// Nome do usuário logado.
  String get userName => _permissions.user?.name ?? 'Visitante';

  /// Rótulo de papel exibido no rodapé da sidebar.
  String get userRole => _permissions.user?.roleLabel ?? 'Não autenticado';

  /// Destinos visíveis conforme a permissão efetiva do usuário (SUPERADMIN vê
  /// tudo — o gating por permissão é centralizado no [PermissionService]).
  List<NavDestination> get visibleDestinations => <NavDestination>[
    for (final destination in navDestinations)
      if (_permissions.canAny(destination.requiredPermissions)) destination,
  ];

  /// Layout particionado (soltos + seções) já podado por visibilidade.
  SidebarLayout get sidebarLayout => buildSidebarLayout(visibleDestinations);

  void _onPermissionsChanged() => notifyListeners();

  @override
  void dispose() {
    _permissions.removeListener(_onPermissionsChanged);
    super.dispose();
  }
}
