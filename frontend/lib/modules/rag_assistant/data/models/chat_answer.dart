/// Trecho de documento citado na resposta do assistente.
class ChatCitation {
  const ChatCitation({
    required this.documentId,
    required this.chunkId,
    required this.filename,
    required this.excerpt,
  });

  final String documentId;
  final String chunkId;
  final String filename;
  final String excerpt;

  factory ChatCitation.fromJson(Map<String, dynamic> json) => ChatCitation(
    documentId: json['documentId']?.toString() ?? '',
    chunkId: json['chunkId']?.toString() ?? '',
    filename: json['filename']?.toString() ?? '',
    excerpt: json['excerpt']?.toString() ?? '',
  );
}

/// Resposta de `POST /chat/query` — espelha o `ChatQueryResponseDto`.
class ChatAnswer {
  const ChatAnswer({
    required this.conversationId,
    required this.answer,
    this.citations = const <ChatCitation>[],
  });

  final String conversationId;
  final String answer;
  final List<ChatCitation> citations;

  factory ChatAnswer.fromJson(Map<String, dynamic> json) => ChatAnswer(
    conversationId: json['conversationId']?.toString() ?? '',
    answer: json['answer']?.toString() ?? '',
    citations: (json['citations'] as List<dynamic>? ?? const <dynamic>[])
        .whereType<Map<String, dynamic>>()
        .map(ChatCitation.fromJson)
        .toList(growable: false),
  );
}
