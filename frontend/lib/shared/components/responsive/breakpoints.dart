import 'package:flutter/widgets.dart';

/// Três faixas grossas usadas pelo design system para trocar layouts.
///
/// - `mobile`  < 600
/// - `tablet`  600..1024
/// - `desktop` > 1024
enum AppBreakpoint { mobile, tablet, desktop }

/// Limite inferior (inclusivo) de [AppBreakpoint.tablet].
const double kAppBreakpointTablet = 600;

/// Limite inferior (exclusivo) de [AppBreakpoint.desktop].
const double kAppBreakpointDesktop = 1024;

/// Largura máxima da coluna de conteúdo do dashboard; centralizada em telas
/// largas para os cards/gráficos não esticarem de borda a borda.
const double kDashboardMaxContentWidth = 1200;

/// Snapshot da faixa de largura atual.
///
/// Retornado por `context.breakpoints` (tela) ou por
/// [AppBreakpoints.fromConstraints] (largura local dentro de `LayoutBuilder`).
/// Imutável e barato de recriar por build — nunca cachear entre rebuilds.
class AppBreakpoints {
  const AppBreakpoints(this.width);

  /// Constrói o snapshot a partir de [BoxConstraints] — para bucketizar a
  /// largura **local** de um subtree dentro de um `LayoutBuilder`.
  factory AppBreakpoints.fromConstraints(BoxConstraints constraints) =>
      AppBreakpoints(constraints.maxWidth);

  /// Largura em pixels lógicos usada para computar a faixa.
  final double width;

  /// Faixa ativa.
  AppBreakpoint get value {
    if (width < kAppBreakpointTablet) return AppBreakpoint.mobile;
    if (width < kAppBreakpointDesktop) return AppBreakpoint.tablet;
    return AppBreakpoint.desktop;
  }

  bool get isMobile => value == AppBreakpoint.mobile;
  bool get isTablet => value == AppBreakpoint.tablet;
  bool get isDesktop => value == AppBreakpoint.desktop;

  /// `true` para tablet **ou** desktop — conveniência para "não é celular".
  bool get isTabletOrLarger => !isMobile;
}

extension AppBreakpointsExtension on BuildContext {
  /// Lê o tamanho da tela do `MediaQuery` e devolve um snapshot
  /// [AppBreakpoints].
  AppBreakpoints get breakpoints =>
      AppBreakpoints(MediaQuery.sizeOf(this).width);
}
