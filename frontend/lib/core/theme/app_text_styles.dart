import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'colors_app.dart';

/// Tipografia do design system, consumida via `context.textStyles`.
///
/// Portado do GEDUC (Direção C): títulos em Space Grotesk (ExtraBold) e corpo
/// em Ubuntu. As cores resolvem a partir do [ColorsApp] do tema ativo.
class AppTextStyles {
  final ColorsApp colors;

  AppTextStyles._(this.colors);

  factory AppTextStyles.fromColors(ColorsApp colors) => AppTextStyles._(colors);

  // ---------------------------------------------------------------------------
  // Títulos — Space Grotesk.
  // ---------------------------------------------------------------------------

  /// Título grande — 20px, ExtraBold. Cabeçalhos de página e painéis.
  TextStyle get textTile20 => GoogleFonts.spaceGrotesk(
    fontSize: 20,
    fontWeight: FontWeight.w800,
    color: colors.neutral800,
  );

  /// Título médio — 18px, ExtraBold. Seções e cards de destaque.
  TextStyle get textTile => GoogleFonts.spaceGrotesk(
    fontSize: 18,
    fontWeight: FontWeight.w800,
    color: colors.neutral800,
  );

  /// Título pequeno — 16px, ExtraBold. Subseções e labels de grupo.
  TextStyle get textTile16 => GoogleFonts.spaceGrotesk(
    fontSize: 16,
    fontWeight: FontWeight.w800,
    color: colors.neutral800,
  );

  // ---------------------------------------------------------------------------
  // Corpo de texto — Ubuntu.
  // ---------------------------------------------------------------------------

  TextStyle get textRegular => GoogleFonts.ubuntu(
    fontSize: 15,
    fontWeight: FontWeight.w400,
    color: colors.textSecondary,
  );

  TextStyle get textRegularBold => GoogleFonts.ubuntu(
    fontSize: 15,
    fontWeight: FontWeight.w800,
    color: colors.textSecondary,
  );

  TextStyle get textSmall => GoogleFonts.ubuntu(
    fontSize: 12,
    fontWeight: FontWeight.w400,
    color: colors.textSecondary,
  );

  TextStyle get textSmallBold => GoogleFonts.ubuntu(
    fontSize: 12,
    fontWeight: FontWeight.w800,
    color: colors.textSecondary,
  );

  TextStyle get textVerySmallBold => GoogleFonts.ubuntu(
    fontSize: 10,
    fontWeight: FontWeight.w800,
    color: colors.textSecondary,
  );

  TextStyle get textLabel =>
      GoogleFonts.ubuntu(fontSize: 14, color: colors.textSecondary);

  TextStyle get labelElevatedButton => GoogleFonts.ubuntu(
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: FontWeight.w700,
  );
}

extension TextStylesExtensions on BuildContext {
  AppTextStyles get textStyles {
    final brightness = Theme.of(this).brightness;
    final colors = brightness == Brightness.dark
        ? ColorsApp.dark()
        : ColorsApp.light();
    return AppTextStyles.fromColors(colors);
  }
}
