import 'package:flutter/material.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/colors_app.dart';
import '../dividers/app_divider.dart';
import '../responsive/breakpoints.dart';

/// Altura fixa padrão do [AppHeader] (px lógicos).
const double kAppHeaderHeight = 64;

/// Barra superior do shell autenticado.
///
/// Composição: slot [leading] opcional · título · espaçador · [actions] à
/// direita. O título pode vir de [titleText] (+ [subtitleText]) ou do slot
/// livre [title] (que tem precedência).
class AppHeader extends StatelessWidget {
  const AppHeader({
    super.key,
    this.title,
    this.titleText,
    this.subtitleText,
    this.leading,
    this.actions = const <Widget>[],
    this.height = kAppHeaderHeight,
    this.actionSpacing = AppDimensions.gapSm,
    this.hideTitleOnMobile = true,
  });

  final Widget? title;
  final String? titleText;
  final String? subtitleText;
  final Widget? leading;
  final List<Widget> actions;
  final double height;
  final double actionSpacing;
  final bool hideTitleOnMobile;

  static const double _contentPadding = AppDimensions.gapXl;

  bool get _hasTitle => title != null || titleText != null;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final isMobile = context.breakpoints.isMobile;
    final showTitle = _hasTitle && !(isMobile && hideTitleOnMobile);
    return ColoredBox(
      color: colors.surfaceCard,
      child: SizedBox(
        height: height,
        child: SafeArea(
          bottom: false,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: _contentPadding,
                  ),
                  child: Row(
                    children: <Widget>[
                      if (leading != null) ...<Widget>[
                        leading!,
                        AppDimensions.hGapMd,
                      ],
                      if (showTitle)
                        Expanded(
                          child: title != null
                              ? DefaultTextStyle.merge(
                                  style: context.textStyles.textTile.copyWith(
                                    color: colors.textPrimary,
                                    fontWeight: FontWeight.w700,
                                  ),
                                  child: title!,
                                )
                              : _HeaderTitle(
                                  title: titleText!,
                                  subtitle: subtitleText,
                                ),
                        )
                      else
                        const Spacer(),
                      for (int i = 0; i < actions.length; i++) ...<Widget>[
                        if (i > 0) SizedBox(width: actionSpacing),
                        actions[i],
                      ],
                    ],
                  ),
                ),
              ),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: _contentPadding),
                child: AppDivider(variant: AppDividerVariant.regular),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Cabeçalho de duas linhas: título ~18 em negrito sobre subtítulo pequeno
/// e discreto.
class _HeaderTitle extends StatelessWidget {
  const _HeaderTitle({required this.title, this.subtitle});

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final styles = context.textStyles;
    final titleStyle = styles.textTile.copyWith(
      color: colors.textPrimary,
      fontWeight: FontWeight.w700,
    );
    final subtitleStyle = styles.textSmall.copyWith(
      color: colors.textSecondary,
    );
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Text(
          title,
          style: titleStyle,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        if (subtitle != null && subtitle!.isNotEmpty) ...<Widget>[
          Text(
            subtitle!,
            style: subtitleStyle,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ],
    );
  }
}
