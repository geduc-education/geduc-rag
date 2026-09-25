import 'package:flutter/material.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/colors_app.dart';
import '../buttons/app_secondary_button.dart';

/// Estado de carregamento centralizado.
class AppLoadingView extends StatelessWidget {
  const AppLoadingView({super.key});

  @override
  Widget build(BuildContext context) =>
      Center(child: CircularProgressIndicator(color: context.colors.primary));
}

/// Estado de erro com ação opcional de recuperação ([onRetry] + [retryLabel]).
class AppErrorView extends StatelessWidget {
  const AppErrorView({
    super.key,
    required this.message,
    this.onRetry,
    this.retryLabel,
  });

  final String message;
  final VoidCallback? onRetry;

  /// Rótulo da ação de recuperação; `null` usa 'Tentar novamente'.
  final String? retryLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Center(
      child: Padding(
        padding: AppDimensions.paddingXl,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(Icons.cloud_off_outlined, size: 48, color: colors.textMuted),
            AppDimensions.vGapMd,
            Text(
              message,
              textAlign: TextAlign.center,
              style: context.textStyles.textRegular,
            ),
            if (onRetry != null) ...<Widget>[
              AppDimensions.vGapLg,
              AppSecondaryButton(
                label: retryLabel ?? 'Tentar novamente',
                icon: Icons.refresh,
                onPressed: onRetry,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Estado vazio (lista sem itens).
class AppEmptyView extends StatelessWidget {
  const AppEmptyView({
    super.key,
    required this.message,
    this.icon = Icons.inbox_outlined,
  });

  final String message;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Center(
      child: Padding(
        padding: AppDimensions.paddingXl,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(icon, size: 48, color: colors.textMuted),
            AppDimensions.vGapMd,
            Text(
              message,
              textAlign: TextAlign.center,
              style: context.textStyles.textRegular,
            ),
          ],
        ),
      ),
    );
  }
}
