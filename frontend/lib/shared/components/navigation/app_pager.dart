import 'package:flutter/material.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/colors_app.dart';

/// Paginação alinhada à direita: rótulo + anterior/próxima.
///
/// Existia recopiada em três telas com o MESMO nome de classe privada
/// (`_Pagination` na lixeira e nas mensagens da caixa de e-mail, `_Pager` na
/// fila), e os tooltips já divergiam entre elas — "Página anterior" numa,
/// "Anterior" noutra. O [label] fica por conta de quem chama porque cada tela
/// conta uma coisa diferente (páginas, itens de um total, ambos).
///
/// Botão sem callback fica desabilitado: quem chama passa `null` no fim da
/// lista ou durante uma ação em voo, em vez de um handler que não faz nada.
class AppPager extends StatelessWidget {
  const AppPager({
    super.key,
    required this.label,
    required this.onPrevious,
    required this.onNext,
  });

  final String label;
  final VoidCallback? onPrevious;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: <Widget>[
        Text(
          label,
          style: context.textStyles.textSmall.copyWith(
            color: context.colors.textMuted,
          ),
        ),
        AppDimensions.hGapMd,
        IconButton(
          tooltip: 'Página anterior',
          icon: const Icon(Icons.chevron_left),
          onPressed: onPrevious,
        ),
        IconButton(
          tooltip: 'Próxima página',
          icon: const Icon(Icons.chevron_right),
          onPressed: onNext,
        ),
      ],
    );
  }
}
