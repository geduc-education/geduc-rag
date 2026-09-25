import 'package:flutter/material.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/colors_app.dart';
import 'app_sidebar.dart';
import 'app_sidebar_item.dart';

/// Definição de um filho dentro de um [AppSidebarSection].
///
/// É um objeto de valor — `selected` pertence ao pai (via
/// `selectedChildIndex` na seção).
class AppSidebarSubItem {
  const AppSidebarSubItem({
    required this.icon,
    required this.label,
    this.description,
    this.onTap,
    this.routeId,
  });

  final IconData icon;
  final String label;
  final String? description;
  final VoidCallback? onTap;

  /// Identificador opcional usado para marcar este filho como selecionado
  /// quando casa com a rota atual (convenção livre: path, enum, ...).
  final String? routeId;
}

/// Grupo expansível de [AppSidebarSubItem]s compartilhando um header.
///
/// O header se comporta como um [AppSidebarItem]: tocar alterna a expansão.
/// O chevron gira com [AppDimensions.motionBase]; o corpo cresce/encolhe com
/// [AnimatedSize].
class AppSidebarSection extends StatefulWidget {
  const AppSidebarSection({
    super.key,
    required this.icon,
    required this.label,
    required this.children,
    this.description,
    this.initiallyExpanded = false,
    this.selectedChildIndex,
    this.onHeaderTap,
    this.expandAll = false,
  });

  final IconData icon;
  final String label;
  final String? description;
  final List<AppSidebarSubItem> children;
  final bool initiallyExpanded;

  /// Toggle global de expandir/recolher todos os grupos (usado pela Task 6).
  ///
  /// Sincroniza apenas na **mudança** do valor (`didUpdateWidget`): ao mudar,
  /// força este grupo ao novo estado; depois disso o usuário segue alternando
  /// cada grupo individualmente. O auto-expand por [selectedChildIndex] só vence
  /// este flag no **mesmo update** em que o índice muda (navegação); "recolher
  /// tudo" com a rota parada também recolhe o grupo ativo — intencional, para
  /// que o usuário consiga fechar realmente tudo.
  final bool expandAll;

  /// Índice do filho selecionado (destaca a linha correspondente).
  final int? selectedChildIndex;

  /// Hook opcional disparado quando o header é tocado, **além** do
  /// toggle local de expandir/colapsar.
  final VoidCallback? onHeaderTap;

  @override
  State<AppSidebarSection> createState() => _AppSidebarSectionState();
}

class _AppSidebarSectionState extends State<AppSidebarSection> {
  late bool _expanded;

  @override
  void initState() {
    super.initState();
    _expanded =
        widget.expandAll ||
        widget.initiallyExpanded ||
        widget.selectedChildIndex != null;
  }

  @override
  void didUpdateWidget(covariant AppSidebarSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Toggle global: sincroniza apenas na MUDANÇA do flag, preservando os
    // toggles individuais feitos depois.
    if (widget.expandAll != oldWidget.expandAll) {
      _expanded = widget.expandAll;
    }
    // Auto-expand só re-dispara quando o índice muda (navegação): aí ele vence
    // o toggle e reabre o grupo da rota ativa. Se a rota está parada, "recolher
    // tudo" recolhe também o grupo ativo — intencional.
    if (widget.selectedChildIndex != null &&
        widget.selectedChildIndex != oldWidget.selectedChildIndex) {
      _expanded = true;
    }
  }

  void _toggle() {
    setState(() => _expanded = !_expanded);
    widget.onHeaderTap?.call();
  }

  @override
  Widget build(BuildContext context) {
    // No rail (sidebar compacta) o header textual não cabe: a seção preserva o
    // agrupamento com o mesmo divisor sutil do shell e expõe os filhos como
    // ícones com tooltip — sem estado de expansão, que não faz sentido a 72px.
    if (AppSidebarCompactScope.of(context)) {
      return _CompactSection(
        children: widget.children,
        selectedChildIndex: widget.selectedChildIndex,
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        AppSidebarItem(
          icon: widget.icon,
          label: widget.label,
          description: widget.description,
          onTap: _toggle,
          trailing: _Chevron(expanded: _expanded),
        ),
        AnimatedSize(
          duration: AppDimensions.motionBase,
          curve: Curves.easeOut,
          alignment: Alignment.topCenter,
          child: _expanded
              ? _SectionChildren(
                  children: widget.children,
                  selectedChildIndex: widget.selectedChildIndex,
                )
              : const SizedBox(width: double.infinity),
        ),
      ],
    );
  }
}

/// Filhos expandidos de um [AppSidebarSection]: uma linha-guia vertical sutil
/// (os subitens "pendem" desta régua, à la árvore de arquivos — desenho herdado
/// do geduc-painel) seguida da coluna de [AppSidebarItem]s indentados
/// (`depth: 1`), com destaque por índice via [selectedChildIndex].
class _SectionChildren extends StatelessWidget {
  const _SectionChildren({required this.children, this.selectedChildIndex});

  final List<AppSidebarSubItem> children;
  final int? selectedChildIndex;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 2, left: AppDimensions.gapMd),
      child: Container(
        key: const ValueKey('section-children-guide'),
        padding: const EdgeInsets.only(left: AppDimensions.gapSm),
        decoration: BoxDecoration(
          border: Border(left: BorderSide(color: context.colors.borderSubtle)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            for (int i = 0; i < children.length; i++)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: AppSidebarItem(
                  icon: children[i].icon,
                  label: children[i].label,
                  description: children[i].description,
                  selected: selectedChildIndex == i,
                  onTap: children[i].onTap,
                  dense: true,
                  depth: 1,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Corpo da seção no rail: divisor sutil (no lugar do header textual) seguido
/// dos filhos como [AppSidebarItem]s compactos (ícone + tooltip, sem indent).
class _CompactSection extends StatelessWidget {
  const _CompactSection({required this.children, this.selectedChildIndex});

  final List<AppSidebarSubItem> children;
  final int? selectedChildIndex;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        const AppSidebarRailDivider(),
        for (int i = 0; i < children.length; i++)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: AppSidebarItem(
              icon: children[i].icon,
              label: children[i].label,
              description: children[i].description,
              selected: selectedChildIndex == i,
              onTap: children[i].onTap,
              dense: true,
            ),
          ),
      ],
    );
  }
}

class _Chevron extends StatelessWidget {
  const _Chevron({required this.expanded});
  final bool expanded;

  @override
  Widget build(BuildContext context) {
    return AnimatedRotation(
      duration: AppDimensions.motionBase,
      turns: expanded ? 0.5 : 0,
      child: Icon(
        Icons.keyboard_arrow_down_rounded,
        size: 18,
        color: context.colors.textSecondary,
      ),
    );
  }
}
