import 'package:flutter/material.dart';

import '../auth/app_permissions.dart';

/// Seção de agrupamento do menu lateral. Puramente de apresentação — a
/// visibilidade de cada item é decidida pelas permissões.
enum NavGroup {
  /// Gestão da plataforma (Usuários, Funcionários e, em seguida, Tenants).
  administracao,

  /// Assistente RAG (Documentos e Chat), escopado pelo tenant ativo.
  assistente,
}

/// Item declarativo do menu lateral do shell, **permission-aware**.
///
/// `route` é o path absoluto sob `/home/...`. `requiredPermissions` vazio =
/// visível para qualquer autenticado; senão o item aparece com **pelo menos
/// uma** das chaves (união). As chaves vêm de [AppPermissions].
final class NavDestination {
  const NavDestination({
    required this.label,
    required this.icon,
    required this.route,
    this.requiredPermissions = const <String>[],
    this.description,
    this.group,
  });

  final String label;
  final IconData icon;
  final String route;
  final List<String> requiredPermissions;

  /// Subtítulo curto exibido sob o [label] (≤ 28 chars).
  final String? description;

  /// Seção de agrupamento na sidebar. `null` = item solto.
  final NavGroup? group;
}

/// Catálogo de destinos do menu.
const List<NavDestination> navDestinations = <NavDestination>[
  NavDestination(
    label: 'Início',
    icon: Icons.home_outlined,
    route: '/home/dashboard',
    description: 'Visão geral',
  ),
  NavDestination(
    label: 'Calendário Acadêmico',
    icon: Icons.calendar_month_outlined,
    route: '/home/academic-calendar',
    description: 'Datas e eventos letivos',
  ),
  NavDestination(
    label: 'Usuários',
    icon: Icons.manage_accounts_outlined,
    route: '/home/users',
    requiredPermissions: <String>[AppPermissions.userRead],
    description: 'Equipe e acessos',
    group: NavGroup.administracao,
  ),
  NavDestination(
    label: 'Funcionários',
    icon: Icons.badge_outlined,
    route: '/home/employees',
    requiredPermissions: <String>[AppPermissions.employeeRead],
    description: 'Cadastro do tenant',
    group: NavGroup.administracao,
  ),
  NavDestination(
    label: 'Documentos',
    icon: Icons.description_outlined,
    route: '/home/rag/documents',
    requiredPermissions: <String>[AppPermissions.documentRead],
    description: 'Base de conhecimento',
    group: NavGroup.assistente,
  ),
  NavDestination(
    label: 'Assistente',
    icon: Icons.forum_outlined,
    route: '/home/rag/chat',
    requiredPermissions: <String>[AppPermissions.chatQuery],
    description: 'Perguntas com citações',
    group: NavGroup.assistente,
  ),
  NavDestination(
    label: 'Novidades',
    icon: Icons.campaign_outlined,
    route: '/home/changelog',
    description: 'Atualizações do produto',
  ),
];

/// Rótulo de exibição da seção [group] na sidebar.
String navGroupLabel(NavGroup group) => switch (group) {
  NavGroup.administracao => 'Administração',
  NavGroup.assistente => 'Assistente',
};

/// Ícone do header do grupo [group] na sidebar.
IconData navGroupIcon(NavGroup group) => switch (group) {
  NavGroup.administracao => Icons.admin_panel_settings_outlined,
  NavGroup.assistente => Icons.auto_awesome_outlined,
};

/// Descrição curta do grupo — tooltip do header na sidebar.
String navGroupDescription(NavGroup group) => switch (group) {
  NavGroup.administracao => 'Gestão da plataforma',
  NavGroup.assistente => 'Documentos e chat do RAG',
};

/// Ordem fixa das seções na sidebar.
const List<NavGroup> navGroupOrder = <NavGroup>[
  NavGroup.administracao,
  NavGroup.assistente,
];

/// Seção agrupada com seus itens já podados por visibilidade.
typedef SidebarSection = ({NavGroup group, List<NavDestination> items});

/// Layout do menu particionado em soltos (topo/rodapé) e seções.
typedef SidebarLayout = ({
  List<NavDestination> topLoose,
  List<SidebarSection> sections,
  List<NavDestination> bottomLoose,
});

/// Particiona [visible] no layout da sidebar: item solto vai pro rodapé quando
/// aparece **depois** de todo item agrupado em [navDestinations], senão vai
/// pro topo. Seções sem item visível são omitidas.
SidebarLayout buildSidebarLayout(List<NavDestination> visible) {
  final lastGroupedIndex = navDestinations.lastIndexWhere(
    (d) => d.group != null,
  );
  final topLoose = <NavDestination>[];
  final bottomLoose = <NavDestination>[];
  final grouped = <NavGroup, List<NavDestination>>{};
  for (final destination in visible) {
    final group = destination.group;
    if (group == null) {
      final isBottom = navDestinations.indexOf(destination) > lastGroupedIndex;
      (isBottom ? bottomLoose : topLoose).add(destination);
    } else {
      grouped.putIfAbsent(group, () => <NavDestination>[]).add(destination);
    }
  }
  final sections = <SidebarSection>[
    for (final group in navGroupOrder)
      if (grouped[group]?.isNotEmpty ?? false)
        (group: group, items: grouped[group]!),
  ];
  return (topLoose: topLoose, sections: sections, bottomLoose: bottomLoose);
}
