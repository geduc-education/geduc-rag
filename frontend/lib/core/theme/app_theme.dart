import 'package:flutter/material.dart';

import 'colors_app.dart';

/// Tema base do app. O design system real é consumido via `context.colors`,
/// `context.textStyles` e `context.breakpoints`; aqui apenas alinhamos o
/// `ThemeData` do Material (seed, superfícies) aos tokens do [ColorsApp] para
/// que widgets padrão do framework combinem com o DS.
class AppTheme {
  const AppTheme._();

  static ThemeData get light => _build(ColorsApp.light(), Brightness.light);

  static ThemeData get dark => _build(ColorsApp.dark(), Brightness.dark);

  static ThemeData _build(ColorsApp colors, Brightness brightness) {
    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      scaffoldBackgroundColor: colors.surfaceCanvas,
      colorScheme: ColorScheme.fromSeed(
        seedColor: colors.primary,
        brightness: brightness,
      ),
    );
  }
}
