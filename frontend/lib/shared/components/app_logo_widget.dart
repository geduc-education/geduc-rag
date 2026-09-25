import 'package:flutter/material.dart';

import '../../core/theme/app_dimensions.dart';
import '../../core/theme/app_text_styles.dart';
import '../../core/theme/colors_app.dart';

/// Marca da plataforma usada na sidebar.
///
/// Auto-contida (sem dependência de asset SVG): um selo com ícone da marca
/// sobre a cor da marca + o wordmark "GEDUC RAG". Em [useMark] (rail
/// compacto) exibe só o selo. Substituir por um logo real é trabalho futuro;
/// para manter o scaffold sem assets ausentes, o mark é desenhado em código.
class AppLogoWidget extends StatelessWidget {
  const AppLogoWidget({super.key, this.height = 40, this.useMark = false});

  final double height;
  final bool useMark;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final mark = Container(
      width: height,
      height: height,
      decoration: BoxDecoration(
        color: colors.primary,
        borderRadius: AppDimensions.borderRadiusSm,
      ),
      alignment: Alignment.center,
      child: Icon(
        Icons.auto_awesome_rounded,
        color: colors.white,
        size: height * 0.56,
      ),
    );
    if (useMark) return mark;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        mark,
        AppDimensions.hGapMd,
        Flexible(
          child: Text(
            'GEDUC RAG',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: context.textStyles.textTile16.copyWith(
              color: colors.textPrimary,
            ),
          ),
        ),
      ],
    );
  }
}
