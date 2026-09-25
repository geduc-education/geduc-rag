import 'package:flutter/material.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/colors_app.dart';

/// Tom da faixa — define a paleta inteira (fundo, borda, ícone e texto).
enum AppNoticeTone {
  /// Contexto neutro: herança de configuração, explicação de escopo.
  info,

  /// Consequência futura a observar: prazo de expurgo, chave a publicar.
  warning,
}

/// Faixa de aviso INLINE, dentro do fluxo da tela — não é toast nem diálogo.
///
/// Existia recopiada em quatro lugares (banner de erro, herança de e-mail,
/// retenção da lixeira, publicação do widget), sempre com o mesmo
/// `Container` + `Row` + `Icon` + `Expanded(Text)` e só trocando a família de
/// cor. Cada cópia era uma chance de a paleta de aviso divergir por tela.
///
/// Colapsa em `SizedBox.shrink()` com [message] nula ou vazia: quem chama não
/// precisa envolver o widget num `if`.
class AppInlineNotice extends StatelessWidget {
  const AppInlineNotice({
    super.key,
    required this.message,
    required this.icon,
    this.tone = AppNoticeTone.info,
    this.child,
  });

  final String? message;
  final IconData icon;
  final AppNoticeTone tone;

  /// Conteúdo OPCIONAL sob a mensagem, dentro da faixa (botão de ação, chaves
  /// em mono, …). Quem passa estiliza — a faixa só posiciona.
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final message = this.message;
    if (message == null || message.isEmpty) return const SizedBox.shrink();
    final colors = context.colors;
    final palette = switch (tone) {
      AppNoticeTone.info => (
        background: colors.info50,
        border: colors.info100,
        icon: colors.info500,
        text: colors.info700,
      ),
      AppNoticeTone.warning => (
        background: colors.warning50,
        border: colors.warning100,
        icon: colors.warning700,
        text: colors.warning700,
      ),
    };
    return Container(
      width: double.infinity,
      padding: AppDimensions.paddingMd,
      decoration: BoxDecoration(
        color: palette.background,
        borderRadius: AppDimensions.borderRadius,
        border: Border.all(color: palette.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(icon, color: palette.icon, size: AppDimensions.iconSizeMd),
          AppDimensions.hGapSm,
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Text(
                  message,
                  style: context.textStyles.textSmall.copyWith(
                    color: palette.text,
                  ),
                ),
                ?child,
              ],
            ),
          ),
        ],
      ),
    );
  }
}
