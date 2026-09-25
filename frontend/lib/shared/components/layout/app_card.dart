import 'package:flutter/material.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/colors_app.dart';

/// Variação visual do [AppCard].
enum AppCardVariant {
  /// Cartão solto: raio [AppDimensions.borderRadius], borda completa e sombra
  /// [AppDimensions.shadowSm]. Padrão.
  elevated,

  /// Linha contínua (ex.: item de lista): bordas retas, sem sombra, divisória
  /// inferior de 1px e faixa de acento à esquerda quando selecionado.
  flat,
}

/// Card canônico do design system: superfície [ColorsApp.surfaceCard], elevação
/// [AppDimensions.shadowSm] e raio [AppDimensions.borderRadius].
///
/// Expõe um único slot de conteúdo ([child]) e os estados [selected] e hover
/// (este último ativo apenas quando há [onTap]). Formaliza o padrão de cards
/// antes montados inline com `Container` repetido em vários módulos.
///
/// A [variant] alterna entre o cartão elevado (padrão) e a linha [flat],
/// compartilhando a mesma máquina de hover/seleção e a mesma superfície.
class AppCard extends StatefulWidget {
  const AppCard({
    super.key,
    required this.child,
    this.onTap,
    this.selected = false,
    this.padding = AppDimensions.paddingMd,
    this.variant = AppCardVariant.elevated,
  });

  /// Conteúdo do card.
  final Widget child;

  /// Callback de toque. Quando nulo, o card não reage a hover/press.
  final VoidCallback? onTap;

  /// Estado selecionado — borda de acento e superfície destacada.
  final bool selected;

  /// Espaçamento interno do conteúdo.
  final EdgeInsetsGeometry padding;

  /// Variação visual (elevado x linha). Ver [AppCardVariant].
  final AppCardVariant variant;

  @override
  State<AppCard> createState() => _AppCardState();
}

class _AppCardState extends State<AppCard> {
  bool _hovered = false;

  bool get _interactive => widget.onTap != null;

  void _setHovered(bool value) {
    if (!_interactive || _hovered == value) return;
    setState(() => _hovered = value);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final content = AnimatedContainer(
      duration: AppDimensions.motionFast,
      padding: widget.padding,
      decoration: _decoration(colors),
      child: widget.child,
    );

    if (!_interactive) return content;

    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => _setHovered(true),
      onExit: (_) => _setHovered(false),
      child: GestureDetector(onTap: widget.onTap, child: content),
    );
  }

  BoxDecoration _decoration(ColorsApp colors) {
    final background = _backgroundColor(colors);
    switch (widget.variant) {
      case AppCardVariant.elevated:
        return BoxDecoration(
          color: background,
          borderRadius: AppDimensions.borderRadius,
          border: Border.all(color: _borderColor(colors)),
          boxShadow: AppDimensions.shadowSm,
        );
      case AppCardVariant.flat:
        return BoxDecoration(
          color: background,
          border: Border(
            left: BorderSide(
              color: widget.selected ? colors.primary : colors.transparent,
              width: _kFlatAccentWidth,
            ),
            bottom: BorderSide(color: colors.borderSubtle),
          ),
        );
    }
  }

  Color _backgroundColor(ColorsApp colors) {
    if (widget.selected) return colors.surfaceMuted;
    if (_hovered) return colors.neutral50;
    return colors.surfaceCard;
  }

  Color _borderColor(ColorsApp colors) {
    if (widget.selected) return colors.primary;
    if (_hovered) return colors.borderDefault;
    return colors.borderSubtle;
  }
}

/// Largura da faixa de acento à esquerda da variante [AppCardVariant.flat].
/// Ocupa espaço mesmo transparente (não selecionado), mantendo o conteúdo
/// estável ao alternar a seleção.
const double _kFlatAccentWidth = AppDimensions.gapXs;
