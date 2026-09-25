import 'package:flutter/foundation.dart';

import '../../../../core/errors/app_exception.dart';
import '../../../../core/tenancy/tenant_context.dart';
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
///
/// A conversa pertence ao tenant: com [tenants], o próprio controller observa
/// o tenant ativo e, quando ele muda (troca ou logout), descarta a conversa e
/// ignora a resposta de um envio iniciado no tenant anterior — mesmo sem a
/// tela montada.
class ChatController extends ChangeNotifier {
  ChatController(this._repository, {TenantContext? tenants})
    : _tenants = tenants,
      _tenantId = tenants?.activeTenantId {
    tenants?.addListener(_onTenantChanged);
  }

  final IRagChatRepository _repository;
  final TenantContext? _tenants;
  String? _tenantId;

  /// Incrementada a cada descarte da conversa; um envio só aplica a resposta
  /// se a geração não mudou enquanto aguardava.
  int _generation = 0;

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
    final generation = _generation;
    _isSending = true;
    _errorMessage = null;
    _append(ChatTurn(role: ChatRole.user, text: text));
    try {
      final answer = await _repository.ask(
        text,
        conversationId: _conversationId,
      );
      if (generation != _generation) return;
      _conversationId = answer.conversationId;
      _append(
        ChatTurn(
          role: ChatRole.assistant,
          text: answer.answer,
          citations: answer.citations,
        ),
      );
    } on AppException catch (e) {
      if (generation != _generation) return;
      _errorMessage = e.message;
    } catch (_) {
      if (generation != _generation) return;
      _errorMessage = 'Não foi possível obter a resposta do assistente.';
    }
    _isSending = false;
    notifyListeners();
  }

  /// Descarta a conversa atual; o próximo envio abre uma conversa nova.
  void newConversation() {
    if (_isSending) return;
    _reset();
  }

  /// Tenant ativo mudou: descarta a conversa, inclusive um envio pendente.
  void _onTenantChanged() {
    final tenantId = _tenants?.activeTenantId;
    if (tenantId == _tenantId) return;
    _tenantId = tenantId;
    _reset();
  }

  void _reset() {
    _generation++;
    _turns = const <ChatTurn>[];
    _conversationId = null;
    _errorMessage = null;
    _isSending = false;
    notifyListeners();
  }

  @override
  void dispose() {
    _tenants?.removeListener(_onTenantChanged);
    super.dispose();
  }

  void _append(ChatTurn turn) {
    _turns = List<ChatTurn>.unmodifiable(<ChatTurn>[..._turns, turn]);
    notifyListeners();
  }
}
