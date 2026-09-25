import 'package:flutter/material.dart';

import '../../../../../core/theme/app_dimensions.dart';
import '../../../../../core/theme/app_text_styles.dart';
import '../../../../../core/theme/colors_app.dart';
import '../chat_controller.dart';
import 'citation_card.dart';

/// Largura máxima de uma bolha, para a leitura não esticar em telas largas.
const double _kBubbleMaxWidth = 720;

/// Tamanho do indicador de carregamento da bolha pendente.
const double _kPendingIndicatorSize = 16;

/// Bolha do chat. A do usuário fica à direita, em destaque; a do assistente
/// fica à esquerda, com as citações abaixo do texto. Com [turn] nulo,
/// renderiza a bolha pendente do assistente (indicador de carregamento).
class ChatBubble extends StatelessWidget {
  const ChatBubble({super.key, required this.turn});

  /// Bolha pendente do assistente enquanto a resposta não chega.
  const ChatBubble.pending({super.key}) : turn = null;

  final ChatTurn? turn;

  bool get _isUser => turn?.role == ChatRole.user;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Align(
      alignment: _isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: _kBubbleMaxWidth),
        child: Container(
          padding: AppDimensions.paddingMd,
          decoration: BoxDecoration(
            color: _isUser ? colors.primary : colors.surfaceCard,
            borderRadius: AppDimensions.borderRadius,
            border: _isUser ? null : Border.all(color: colors.borderSubtle),
            boxShadow: AppDimensions.shadowSm,
          ),
          child: _BubbleContent(turn: turn),
        ),
      ),
    );
  }
}

class _BubbleContent extends StatelessWidget {
  const _BubbleContent({required this.turn});

  final ChatTurn? turn;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final styles = context.textStyles;
    final current = turn;
    if (current == null) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          SizedBox.square(
            dimension: _kPendingIndicatorSize,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: colors.primary,
            ),
          ),
          AppDimensions.hGapSm,
          Text(
            'Consultando os documentos...',
            style: styles.textSmall.copyWith(color: colors.textSecondary),
          ),
        ],
      );
    }
    final isUser = current.role == ChatRole.user;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        SelectableText(
          current.text,
          style: styles.textRegular.copyWith(
            color: isUser ? colors.white : colors.textPrimary,
          ),
        ),
        for (final citation in current.citations) ...<Widget>[
          AppDimensions.vGapSm,
          CitationCard(citation: citation),
        ],
      ],
    );
  }
}
