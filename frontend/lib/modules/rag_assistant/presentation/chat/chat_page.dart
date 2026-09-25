import 'package:flutter/material.dart';
import 'package:flutter_modular/flutter_modular.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../shared/components/buttons/app_primary_button.dart';
import '../../../../shared/components/buttons/app_secondary_button.dart';
import '../../../../shared/components/feedback/app_error_banner.dart';
import '../../../../shared/components/feedback/app_state_views.dart';
import '../../../../shared/components/forms/app_text_field.dart';
import 'chat_controller.dart';
import 'widgets/chat_bubble.dart';

/// Tela Chat do assistente RAG: pergunta sobre os documentos do tenant ativo
/// e exibe as respostas com as citações dos trechos usados.
class ChatPage extends StatefulWidget {
  const ChatPage({super.key});

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  late final ChatController _controller;
  final _input = TextEditingController();
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _controller = inject<ChatController>();
    _controller.addListener(_scrollToEnd);
  }

  @override
  void dispose() {
    _controller.removeListener(_scrollToEnd);
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.animateTo(
        _scroll.position.maxScrollExtent,
        duration: AppDimensions.motionFast,
        curve: Curves.easeOut,
      );
    });
  }

  void _send([String? _]) {
    final question = _input.text;
    if (question.trim().isEmpty || _controller.isSending) return;
    _input.clear();
    _controller.send(question);
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) => Padding(
        padding: AppDimensions.paddingXl,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Align(
              alignment: Alignment.centerRight,
              child: AppSecondaryButton(
                label: 'Nova conversa',
                icon: Icons.add_comment_outlined,
                onPressed: _controller.isSending
                    ? null
                    : _controller.newConversation,
              ),
            ),
            AppDimensions.vGapLg,
            Expanded(
              child: _Messages(controller: _controller, scroll: _scroll),
            ),
            AppDimensions.vGapMd,
            AppErrorBanner(message: _controller.errorMessage),
            if (_controller.errorMessage != null) AppDimensions.vGapMd,
            _Composer(
              input: _input,
              sending: _controller.isSending,
              onSend: _send,
            ),
          ],
        ),
      ),
    );
  }
}

/// Lista de bolhas; com a conversa vazia, um convite para perguntar.
class _Messages extends StatelessWidget {
  const _Messages({required this.controller, required this.scroll});

  final ChatController controller;
  final ScrollController scroll;

  @override
  Widget build(BuildContext context) {
    final turns = controller.turns;
    if (turns.isEmpty && !controller.isSending) {
      return const AppEmptyView(
        message: 'Pergunte algo sobre os documentos do tenant.',
        icon: Icons.forum_outlined,
      );
    }
    final count = turns.length + (controller.isSending ? 1 : 0);
    return ListView.separated(
      controller: scroll,
      itemCount: count,
      separatorBuilder: (_, _) => AppDimensions.vGapMd,
      itemBuilder: (_, i) => i < turns.length
          ? ChatBubble(turn: turns[i])
          : const ChatBubble.pending(),
    );
  }
}

/// Campo da pergunta (Enter envia) e botão "Enviar".
class _Composer extends StatelessWidget {
  const _Composer({
    required this.input,
    required this.sending,
    required this.onSend,
  });

  final TextEditingController input;
  final bool sending;
  final ValueChanged<String?> onSend;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: <Widget>[
        Expanded(
          child: AppTextField(
            label: 'Pergunta',
            hint: 'Digite sua pergunta e pressione Enter',
            controller: input,
            autofocus: true,
            onSubmitted: onSend,
          ),
        ),
        AppDimensions.hGapLg,
        AppPrimaryButton(
          label: 'Enviar',
          icon: Icons.send,
          loading: sending,
          onPressed: () => onSend(null),
        ),
      ],
    );
  }
}
