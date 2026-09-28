import 'package:flutter/material.dart';
import 'package:flutter_modular/flutter_modular.dart';

import '../../../core/auth/permission_service.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/colors_app.dart';
import '../../changelog/presentation/widgets/changelog_recent_card.dart';

/// Tela inicial do shell: saudação e o card "Novidades recentes", visível
/// para qualquer usuário logado.
class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final name = inject<PermissionService>().user?.name ?? '';
    return SingleChildScrollView(
      padding: AppDimensions.paddingXl,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(
              Icons.auto_awesome_outlined,
              size: 48,
              color: colors.textMuted,
            ),
            AppDimensions.vGapLg,
            Text(
              name.isEmpty ? 'Bem-vindo' : 'Olá, $name',
              style: context.textStyles.textTile20,
            ),
            AppDimensions.vGapXl,
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: const ChangelogRecentCard(),
            ),
          ],
        ),
      ),
    );
  }
}
