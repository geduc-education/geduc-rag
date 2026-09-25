import 'package:flutter/material.dart';

/// Tokens de espaçamento, raio, sombra e movimento do design system.
///
/// Portado do GEDUC. Preferir estes tokens a literais soltos em
/// `SizedBox`/`EdgeInsets`/`Padding`/`BorderRadius`.
abstract final class AppDimensions {
  // ---------------------------------------------------------------------------
  // Raios
  // ---------------------------------------------------------------------------
  static final BorderRadius borderRadius = BorderRadius.circular(10);
  static final BorderRadius borderRadiusCardSidebar = BorderRadius.circular(8);
  static final BorderRadius borderRadiusSm = BorderRadius.circular(6);
  static final BorderRadius buttonBorderRadius = BorderRadius.circular(12);
  static final BorderRadius dialogsBorderRadius = BorderRadius.circular(18);
  static final BorderRadius radiusScreen = BorderRadius.circular(20);

  /// Raio totalmente arredondado ("pill") — chips e barras de progresso.
  static final BorderRadius borderRadiusPill = BorderRadius.circular(999);

  // ---------------------------------------------------------------------------
  // Escala de espaçamento (base 4) — tokens canônicos de gap.
  // ---------------------------------------------------------------------------
  static const double gapXs = 4.0;
  static const double gapSm = 8.0;
  static const double gapMd = 12.0;
  static const double gapLg = 16.0;
  static const double gapXl = 24.0;
  static const double gapXxl = 32.0;

  // Gaps verticais — use dentro de Column/ListView.
  static const Widget vGapXs = SizedBox(height: gapXs);
  static const Widget vGapSm = SizedBox(height: gapSm);
  static const Widget vGapMd = SizedBox(height: gapMd);
  static const Widget vGapLg = SizedBox(height: gapLg);
  static const Widget vGapXl = SizedBox(height: gapXl);
  static const Widget vGapXxl = SizedBox(height: gapXxl);

  // Gaps horizontais — use dentro de Row.
  static const Widget hGapXs = SizedBox(width: gapXs);
  static const Widget hGapSm = SizedBox(width: gapSm);
  static const Widget hGapMd = SizedBox(width: gapMd);
  static const Widget hGapLg = SizedBox(width: gapLg);
  static const Widget hGapXl = SizedBox(width: gapXl);
  static const Widget hGapXxl = SizedBox(width: gapXxl);

  // ---------------------------------------------------------------------------
  // Paddings
  // ---------------------------------------------------------------------------
  static const EdgeInsets marginHorizontal = EdgeInsets.symmetric(
    horizontal: 20,
  );
  static const EdgeInsets padding = EdgeInsets.all(8);
  static const EdgeInsets paddingZero = EdgeInsets.all(0);
  static const EdgeInsets paddingXs = EdgeInsets.all(gapXs);
  static const EdgeInsets paddingSm = EdgeInsets.all(gapSm);
  static const EdgeInsets paddingMd = EdgeInsets.all(gapMd);
  static const EdgeInsets paddingLg = EdgeInsets.all(gapLg);
  static const EdgeInsets paddingXl = EdgeInsets.all(gapXl);

  static const double space = 20.0;

  /// Gutter esquerdo unificado da sidebar — linha de início dos glifos.
  static const double sidebarGutter = 20.0;

  /// Inset horizontal da lista de itens do menu. Somado ao padding interno
  /// do item (12) coloca o ícone em [sidebarGutter] (8 + 12 = 20).
  static const double sidebarMenuInset = 8.0;

  /// Largura da sidebar no modo encolhido (rail): só ícones + tooltips.
  static const double sidebarRailWidth = 72.0;

  /// Espessura da accent bar do item selecionado da sidebar; também o raio
  /// dos cantos direitos dela (desliza da borda esquerda em `-sidebarAccentWidth`).
  static const double sidebarAccentWidth = 4.0;

  // ---------------------------------------------------------------------------
  // Tamanhos de componente
  // ---------------------------------------------------------------------------
  /// Tamanho de ícone inline extrapequeno (toggles auxiliares da sidebar).
  static const double iconSizeXs = 16.0;

  /// Tamanho de ícone inline médio (banner/headers de seção).
  static const double iconSizeMd = 20.0;

  /// Avatar pequeno (iniciais em balões de mensagem agrupados).
  static const double avatarSm = 36.0;

  /// Avatar médio (iniciais na lista de conversas e no header do chat).
  static const double avatarMd = 44.0;

  /// Altura padrão de campos de entrada.
  static const double inputHeight = 48.0;

  /// Largura de um campo de hora `HH:mm` (`AppTimeField`) em layout não
  /// compacto — justa para 5 caracteres; o texto de erro não cabe, por isso
  /// esses campos reportam a mensagem fora do campo (`showErrorText: false`).
  static const double timeFieldWidth = 96.0;

  /// Largura mínima de selo numérico ("pill" de ordem/contagem) — mantém a
  /// mesma silhueta com 1 ou 2 dígitos, sem virar uma pastilha estreita.
  static const double badgeMinWidth = 24.0;

  /// Alvo mínimo de toque recomendado (Material/a11y) para gatilhos
  /// interativos — botões, avatares clicáveis e ícones de ação.
  static const double minTouchTarget = 48.0;

  /// Largura do toast flutuante (SnackBar) em telas largas — no mobile o
  /// snackbar ocupa a largura padrão do Material.
  static const double toastWidth = 480.0;

  // ---------------------------------------------------------------------------
  // Sombras — tokens de elevação neutros.
  // ---------------------------------------------------------------------------
  static const List<BoxShadow> shadowXs = <BoxShadow>[
    BoxShadow(color: Color(0x0D000000), blurRadius: 2, offset: Offset(0, 1)),
  ];

  static const List<BoxShadow> shadowSm = <BoxShadow>[
    BoxShadow(color: Color(0x14000000), blurRadius: 4, offset: Offset(0, 1)),
  ];

  static const List<BoxShadow> shadowMd = <BoxShadow>[
    BoxShadow(color: Color(0x1F000000), blurRadius: 10, offset: Offset(0, 4)),
    BoxShadow(color: Color(0x0A000000), blurRadius: 2, offset: Offset(0, 1)),
  ];

  static const List<BoxShadow> shadowLg = <BoxShadow>[
    BoxShadow(color: Color(0x2E000000), blurRadius: 24, offset: Offset(0, 12)),
    BoxShadow(color: Color(0x14000000), blurRadius: 6, offset: Offset(0, 2)),
  ];

  // ---------------------------------------------------------------------------
  // Movimento — durações de animação.
  // ---------------------------------------------------------------------------
  static const Duration motionFast = Duration(milliseconds: 120);
  static const Duration motionBase = Duration(milliseconds: 200);
  static const Duration motionSlow = Duration(milliseconds: 320);
}
