import 'package:flutter/material.dart';

/// Tokens de cor centralizados do design system da plataforma.
///
/// Portado do GEDUC (onda 114, Direção C): expõe a marca, os tons semânticos
/// (success/warning/danger/info/purple), a escala neutra de 9 passos, as
/// superfícies e as bordas. Cada token tem contraparte para [Brightness.light]
/// e [Brightness.dark] com o mesmo nome — os valores divergem, a API pública
/// não. Consumido sempre via `context.colors`.
class ColorsApp {
  final Brightness brightness;

  ColorsApp._(this.brightness);

  factory ColorsApp.light() => ColorsApp._(Brightness.light);

  factory ColorsApp.dark() => ColorsApp._(Brightness.dark);

  bool get _isDark => brightness == Brightness.dark;

  // ---------------------------------------------------------------------------
  // Brand
  // ---------------------------------------------------------------------------
  Color get primary => const Color(0xFFEC6109);
  Color get primaryLight => const Color(0xFFFF8C42);
  Color get secondary => const Color(0xFF09ACB1);

  // ---------------------------------------------------------------------------
  // Superfícies legadas / utilitárias
  // ---------------------------------------------------------------------------
  Color get white => const Color(0xFFFFFFFF);
  Color get transparent => const Color(0x00000000);

  /// Scrim fixo para barreiras modais — sempre escurece o conteúdo por trás.
  Color get scrim => const Color(0xFF0B0D10);

  Color get success => const Color(0xFF34A853);
  Color get error => const Color(0xFFC50000);
  Color get warning => const Color(0xFFE38A00);

  // ---------------------------------------------------------------------------
  // Paletas semânticas — 4 tons cada (50/100/500/700).
  // 500 é o acento canônico; 50/100 superfícies; 700 forte/pressed.
  // ---------------------------------------------------------------------------

  // success / verde
  Color get success50 =>
      _isDark ? const Color(0xFF0B2417) : const Color(0xFFE7F6EC);
  Color get success100 =>
      _isDark ? const Color(0xFF103A24) : const Color(0xFFCDEBD6);
  Color get success500 =>
      _isDark ? const Color(0xFF4CCB6F) : const Color(0xFF2E9E4F);
  Color get success700 =>
      _isDark ? const Color(0xFF7ADC95) : const Color(0xFF1F7338);

  // warning / âmbar
  Color get warning50 =>
      _isDark ? const Color(0xFF2A1D08) : const Color(0xFFFFF4E0);
  Color get warning100 =>
      _isDark ? const Color(0xFF3F2C0E) : const Color(0xFFFFE5B3);
  Color get warning500 =>
      _isDark ? const Color(0xFFFFB454) : const Color(0xFFE38A00);
  Color get warning700 =>
      _isDark ? const Color(0xFFFFC881) : const Color(0xFFA56300);

  // danger / vermelho
  Color get danger50 =>
      _isDark ? const Color(0xFF2C0E0E) : const Color(0xFFFDECEC);
  Color get danger100 =>
      _isDark ? const Color(0xFF421515) : const Color(0xFFF8C7C7);
  Color get danger500 =>
      _isDark ? const Color(0xFFEF6E6E) : const Color(0xFFD13030);
  Color get danger700 =>
      _isDark ? const Color(0xFFF49595) : const Color(0xFF9A1F1F);

  // info / azul
  Color get info50 =>
      _isDark ? const Color(0xFF0C1F33) : const Color(0xFFE6F0FB);
  Color get info100 =>
      _isDark ? const Color(0xFF112B47) : const Color(0xFFC4DCF5);
  Color get info500 =>
      _isDark ? const Color(0xFF6CA9F0) : const Color(0xFF2E7BD6);
  Color get info700 =>
      _isDark ? const Color(0xFF9AC4F5) : const Color(0xFF1F5AA0);

  // purple / violeta
  Color get purple50 =>
      _isDark ? const Color(0xFF1B1230) : const Color(0xFFF1EAFB);
  Color get purple100 =>
      _isDark ? const Color(0xFF2A1C4A) : const Color(0xFFDCC9F5);
  Color get purple500 =>
      _isDark ? const Color(0xFFB28FE6) : const Color(0xFF7A4DCC);
  Color get purple700 =>
      _isDark ? const Color(0xFFCBB1F0) : const Color(0xFF5530A0);

  // indigo — status "Análise interna" (F4; catálogo usa #6366F1 como acento)
  Color get indigo50 =>
      _isDark ? const Color(0xFF14162E) : const Color(0xFFECEDFD);
  Color get indigo100 =>
      _isDark ? const Color(0xFF1F2247) : const Color(0xFFD5D7FA);
  Color get indigo500 =>
      _isDark ? const Color(0xFF898CF5) : const Color(0xFF6366F1);
  Color get indigo700 =>
      _isDark ? const Color(0xFFAEB0F8) : const Color(0xFF4649B3);

  // ---------------------------------------------------------------------------
  // Neutros — escala de 9 passos, espelhada no dark para manter a semântica.
  // ---------------------------------------------------------------------------
  Color get neutral50 =>
      _isDark ? const Color(0xFF11151B) : const Color(0xFFF8F9FA);
  Color get neutral100 =>
      _isDark ? const Color(0xFF171B22) : const Color(0xFFF1F3F5);
  Color get neutral200 =>
      _isDark ? const Color(0xFF1F2229) : const Color(0xFFE6E8EB);
  Color get neutral300 =>
      _isDark ? const Color(0xFF2A2E36) : const Color(0xFFD3D6DB);
  Color get neutral400 =>
      _isDark ? const Color(0xFF3A3E47) : const Color(0xFFAEB2B9);
  Color get neutral500 =>
      _isDark ? const Color(0xFF6C7079) : const Color(0xFF7A7E85);
  Color get neutral600 =>
      _isDark ? const Color(0xFF9CA0A8) : const Color(0xFF55585E);
  Color get neutral700 =>
      _isDark ? const Color(0xFFC1C4CA) : const Color(0xFF3D4046);
  Color get neutral800 =>
      _isDark ? const Color(0xFFE0E2E6) : const Color(0xFF22252A);
  Color get neutral900 =>
      _isDark ? const Color(0xFFF4F5F7) : const Color(0xFF101317);

  // ---------------------------------------------------------------------------
  // Superfícies — slots nomeados para layout
  // ---------------------------------------------------------------------------
  /// Plano de fundo da página.
  Color get surfaceCanvas => neutral50;

  /// Cards, sidebar, painéis elevados.
  Color get surfaceCard =>
      _isDark ? const Color(0xFF1A1F27) : const Color(0xFFFFFFFF);

  /// Áreas neutras (filtros, headers de seção).
  Color get surfaceMuted =>
      _isDark ? const Color(0xFF1F242C) : const Color(0xFFEFF1F4);

  /// Diálogos, popovers, menus flutuantes.
  Color get surfaceOverlay =>
      _isDark ? const Color(0xFF222831) : const Color(0xFFFFFFFF);

  // ---------------------------------------------------------------------------
  // Bordas
  // ---------------------------------------------------------------------------
  Color get borderSubtle =>
      _isDark ? const Color(0xFF272C35) : const Color(0xFFEAECEF);
  Color get borderDefault =>
      _isDark ? const Color(0xFF353B45) : const Color(0xFFD3D6DB);
  Color get borderStrong =>
      _isDark ? const Color(0xFF4B525E) : const Color(0xFFA9ADB3);

  // ---------------------------------------------------------------------------
  // Aliases de texto — atalhos semânticos.
  // ---------------------------------------------------------------------------
  Color get textPrimary => neutral900;
  Color get textSecondary => neutral600;
  Color get textMuted => neutral500;
  Color get textInverse => _isDark ? neutral900 : white;
}

extension ColorAppExtension on BuildContext {
  ColorsApp get colors {
    final brightness = Theme.of(this).brightness;
    return brightness == Brightness.dark ? ColorsApp.dark() : ColorsApp.light();
  }
}
