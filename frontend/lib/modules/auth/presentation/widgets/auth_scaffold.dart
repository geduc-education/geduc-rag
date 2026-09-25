import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/colors_app.dart';
import '../../../../shared/components/app_logo_widget.dart';

/// Moldura das telas de autenticação: fundo neutro + card centralizado com
/// logo, título/subtítulo e o [child] (formulário).
class AuthScaffold extends StatelessWidget {
  const AuthScaffold({
    super.key,
    required this.title,
    required this.child,
    this.subtitle,
  });

  final String title;
  final String? subtitle;
  final Widget child;

  static const double _cardMaxWidth = 420;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Scaffold(
      backgroundColor: colors.surfaceMuted,
      body: Center(
        child: SingleChildScrollView(
          padding: AppDimensions.paddingXl,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: _cardMaxWidth),
            child: Container(
              padding: AppDimensions.paddingXl,
              decoration: BoxDecoration(
                color: colors.surfaceCard,
                borderRadius: AppDimensions.radiusScreen,
                boxShadow: AppDimensions.shadowMd,
                border: Border.all(color: colors.borderSubtle),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  const Align(
                    alignment: Alignment.centerLeft,
                    child: AppLogoWidget(height: 36),
                  ),
                  AppDimensions.vGapXl,
                  Text(title, style: context.textStyles.textTile20),
                  if (subtitle != null) ...<Widget>[
                    AppDimensions.vGapXs,
                    Text(subtitle!, style: context.textStyles.textRegular),
                  ],
                  AppDimensions.vGapXl,
                  child,
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
