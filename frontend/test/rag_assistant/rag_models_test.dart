import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/modules/rag_assistant/data/models/chat_answer.dart';
import 'package:geduc_rag/modules/rag_assistant/data/models/rag_document.dart';

void main() {
  group('RagDocument.fromJson', () {
    test('converte status processing e marca isInProgress', () {
      final doc = RagDocument.fromJson(<String, dynamic>{
        'documentId': 'd1',
        'filename': 'matricula.md',
        'mimeType': 'text/markdown',
        'sizeBytes': 1234,
        'status': 'processing',
        'errorMessage': null,
        'createdAt': '2026-09-25T10:00:00.000Z',
      });

      expect(doc.documentId, 'd1');
      expect(doc.filename, 'matricula.md');
      expect(doc.mimeType, 'text/markdown');
      expect(doc.sizeBytes, 1234);
      expect(doc.status, RagDocumentStatus.processing);
      expect(doc.isInProgress, isTrue);
      expect(doc.errorMessage, isNull);
      expect(doc.createdAt, DateTime.utc(2026, 9, 25, 10));
    });

    test('status desconhecido cai em failed sem exceção', () {
      final doc = RagDocument.fromJson(<String, dynamic>{
        'documentId': 'd2',
        'status': 'weird',
        'createdAt': '2026-09-25T10:00:00.000Z',
      });

      expect(doc.status, RagDocumentStatus.failed);
      expect(doc.isInProgress, isFalse);
    });

    test('RagDocumentPage lê data e total', () {
      final page = RagDocumentPage.fromJson(<String, dynamic>{
        'data': <Map<String, dynamic>>[
          <String, dynamic>{'documentId': 'd1', 'status': 'ready'},
        ],
        'total': 7,
      });

      expect(page.data.single.status, RagDocumentStatus.ready);
      expect(page.total, 7);
    });
  });

  group('ChatAnswer.fromJson', () {
    test('lê citations com filename e excerpt', () {
      final answer = ChatAnswer.fromJson(<String, dynamic>{
        'conversationId': 'c1',
        'answer': 'A matrícula abre em janeiro.',
        'citations': <Map<String, dynamic>>[
          <String, dynamic>{
            'documentId': 'd1',
            'chunkId': 'k1',
            'filename': 'matricula.md',
            'excerpt': 'A matrícula abre...',
          },
        ],
      });

      expect(answer.conversationId, 'c1');
      expect(answer.answer, 'A matrícula abre em janeiro.');
      expect(answer.citations[0].documentId, 'd1');
      expect(answer.citations[0].chunkId, 'k1');
      expect(answer.citations[0].filename, 'matricula.md');
      expect(answer.citations[0].excerpt, 'A matrícula abre...');
    });
  });
}
