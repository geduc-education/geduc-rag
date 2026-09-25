import 'package:flutter/material.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/colors_app.dart';

/// Card de seção de formulário: título, ação opcional no canto direito e o
/// conteúdo. Compartilhado pelos cadastros com form em card (cliente, sistema)
/// — nasceu no form de cliente e subiu ao design system quando o cadastro de
/// sistemas passou a precisar do mesmo bloco.
class AppSectionCard extends StatelessWidget {
  const AppSectionCard({
    super.key,
    required this.title,
    required this.child,
    this.action,
  });

  final String title;
  final Widget child;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: AppDimensions.paddingXl,
      decoration: BoxDecoration(
        color: colors.surfaceCard,
        borderRadius: AppDimensions.borderRadius,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(title, style: context.textStyles.textTile16),
              ),
              ?action,
            ],
          ),
          AppDimensions.vGapLg,
          child,
        ],
      ),
    );
  }
}
