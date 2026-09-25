import 'package:flutter/foundation.dart';

import '../../../../core/errors/app_exception.dart';
import '../../data/models/chat_answer.dart';
import '../../data/rag_chat_repository.dart';

/// Autor de uma bolha do chat.
enum ChatRole { user, assistant }

/// Uma bolha da conversa: a pergunta do usuário ou a resposta do assistente
/// (esta com as citações dos trechos usados).
class ChatTurn {
  const ChatTurn({
    required this.role,
    required this.text,
    this.citations = const <ChatCitation>[],
  });

  final ChatRole role;
  final String text;
  final List<ChatCitation> citations;
}

/// Controller da tela Chat: mantém as bolhas da conversa atual e o
/// `conversationId` devolvido pelo backend para continuar o histórico.
class ChatController extends ChangeNotifier {
  ChatController(this._repository);

  final IRagChatRepository _repository;

  List<ChatTurn> _turns = const <ChatTurn>[];
  bool _isSending = false;
  String? _conversationId;
  String? _errorMessage;

  List<ChatTurn> get turns => _turns;
  bool get isSending => _isSending;
  String? get conversationId => _conversationId;
  String? get errorMessage => _errorMessage;

  /// Envia [question]. Ignora pergunta vazia e envio durante outro envio.
  Future<void> send(String question) async {
    final text = question.trim();
    if (text.isEmpty || _isSending) return;
    _isSending = true;
    _errorMessage = null;
    _append(ChatTurn(role: ChatRole.user, text: text));
    try {
      final answer = await _repository.ask(
        text,
        conversationId: _conversationId,
      );
      _conversationId = answer.conversationId;
      _append(
        ChatTurn(
          role: ChatRole.assistant,
          text: answer.answer,
          citations: answer.citations,
        ),
      );
    } on AppException catch (e) {
      _errorMessage = e.message;
    } catch (_) {
      _errorMessage = 'Não foi possível obter a resposta do assistente.';
    }
    _isSending = false;
    notifyListeners();
  }

  /// Descarta a conversa atual; o próximo envio abre uma conversa nova.
  void newConversation() {
    if (_isSending) return;
    _turns = const <ChatTurn>[];
    _conversationId = null;
    _errorMessage = null;
    notifyListeners();
  }

  void _append(ChatTurn turn) {
    _turns = List<ChatTurn>.unmodifiable(<ChatTurn>[..._turns, turn]);
    notifyListeners();
  }
}
