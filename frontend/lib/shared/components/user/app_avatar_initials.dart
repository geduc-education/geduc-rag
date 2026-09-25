import 'package:flutter/material.dart';

import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/colors_app.dart';

/// Avatar circular que renderiza 2 letras extraídas de [name].
///
/// A cor de fundo é determinística (derivada do hash do nome) e mapeada em um
/// subconjunto curado de tons semânticos; o texto usa um neutro de alto
/// contraste para manter legibilidade nos dois temas.
class AppAvatarInitials extends StatelessWidget {
  const AppAvatarInitials({super.key, required this.name, this.size = 40});

  final String name;
  final double size;

  @override
  Widget build(BuildContext context) {
    final initials = _initials(name);
    final colors = context.colors;
    final palette = _backgroundFor(name, colors);
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: palette.background,
        shape: BoxShape.circle,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Text(
        initials,
        style: context.textStyles.textRegularBold.copyWith(
          color: palette.foreground,
          fontSize: size * 0.38,
          height: 1.0,
        ),
      ),
    );
  }

  static String _initials(String name) {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return '?';
    final parts = trimmed.split(RegExp(r'\s+'));
    if (parts.length == 1) {
      final only = parts.first;
      return only.characters.take(2).toString().toUpperCase();
    }
    final first = parts.first.characters.first;
    final last = parts.last.characters.first;
    return '$first$last'.toUpperCase();
  }
}

class _AvatarPalette {
  const _AvatarPalette(this.background, this.foreground);
  final Color background;
  final Color foreground;
}

_AvatarPalette _backgroundFor(String name, ColorsApp colors) {
  final slots = <_AvatarPalette>[
    _AvatarPalette(colors.info100, colors.info700),
    _AvatarPalette(colors.success100, colors.success700),
    _AvatarPalette(colors.warning100, colors.warning700),
    _AvatarPalette(colors.danger100, colors.danger700),
    _AvatarPalette(colors.purple100, colors.purple700),
    _AvatarPalette(colors.neutral200, colors.neutral700),
  ];
  if (name.isEmpty) return slots.last;
  var hash = 0;
  for (final code in name.toLowerCase().codeUnits) {
    hash = (hash * 31 + code) & 0x7FFFFFFF;
  }
  return slots[hash % slots.length];
}
