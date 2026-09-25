import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/modules/rag_assistant/data/models/chat_answer.dart';
import 'package:geduc_rag/modules/rag_assistant/data/rag_chat_repository.dart';

/// Repositório fake do chat: registra as perguntas e devolve [answer].
class FakeRagChatRepository implements IRagChatRepository {
  FakeRagChatRepository({
    this.answer = const ChatAnswer(conversationId: 'c1', answer: 'Resposta.'),
    this.failWith,
  });

  ChatAnswer answer;
  AppException? failWith;

  final List<({String question, String? conversationId})> asked =
      <({String question, String? conversationId})>[];

  @override
  Future<ChatAnswer> ask(String question, {String? conversationId}) async {
    asked.add((question: question, conversationId: conversationId));
    final error = failWith;
    if (error != null) throw error;
    return answer;
  }
}
