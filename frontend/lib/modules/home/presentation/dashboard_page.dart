import 'package:flutter/material.dart';
import 'package:flutter_modular/flutter_modular.dart';

import '../../../core/auth/permission_service.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/colors_app.dart';

/// Tela inicial do shell. Por enquanto só a boas-vindas — os atalhos do RAG
/// (Documentos, Assistente) entram quando esses módulos ganharem tela.
class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final name = inject<PermissionService>().user?.name ?? '';
    return Center(
      child: Padding(
        padding: AppDimensions.paddingXl,
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
            AppDimensions.vGapSm,
            Text(
              'O assistente de conhecimento chega nos próximos módulos.',
              style: context.textStyles.textRegular,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
