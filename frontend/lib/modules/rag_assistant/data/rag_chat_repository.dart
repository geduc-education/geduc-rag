import '../../../core/http/api_client.dart';
import 'models/chat_answer.dart';

/// Contrato do repositório do chat do RAG (escopo do tenant ativo).
abstract interface class IRagChatRepository {
  /// Pergunta ao assistente; reenvie [conversationId] para manter o histórico.
  Future<ChatAnswer> ask(String question, {String? conversationId});
}

class RagChatRepository implements IRagChatRepository {
  RagChatRepository(this._client);

  final ApiClient _client;

  @override
  Future<ChatAnswer> ask(String question, {String? conversationId}) async {
    final response = await _client.post<Map<String, dynamic>>(
      '/chat/query',
      data: <String, dynamic>{
        'question': question,
        'conversationId': ?conversationId,
      },
    );
    return ChatAnswer.fromJson(response.data ?? const <String, dynamic>{});
  }
}
