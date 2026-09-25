import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/core/auth/auth_user.dart';
import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/core/storage/local_preferences.dart';
import 'package:geduc_rag/core/tenancy/tenant_context.dart';
import 'package:geduc_rag/modules/rag_assistant/data/models/chat_answer.dart';
import 'package:geduc_rag/modules/rag_assistant/presentation/chat/chat_controller.dart';

import 'package:shared_preferences/shared_preferences.dart';

import '../support/fake_rag_chat_repository.dart';

const ChatAnswer _answer = ChatAnswer(
  conversationId: 'conv-1',
  answer: 'O prazo é de 30 dias.',
  citations: <ChatCitation>[
    ChatCitation(
      documentId: 'd1',
      chunkId: 'k1',
      filename: 'regimento.pdf',
      excerpt: 'O prazo de matrícula é de 30 dias.',
    ),
  ],
);

/// Fake que só responde quando o teste completa [pending].
class _PendingChatRepository extends FakeRagChatRepository {
  final Completer<ChatAnswer> pending = Completer<ChatAnswer>();

  @override
  Future<ChatAnswer> ask(String question, {String? conversationId}) {
    asked.add((question: question, conversationId: conversationId));
    return pending.future;
  }
}

/// Contexto de tenant com os vínculos `a` e `b`, ativo em `a`.
Future<TenantContext> _tenants() async {
  SharedPreferences.setMockInitialValues(<String, Object>{});
  final context = TenantContext(LocalPreferences());
  await context.syncWith(
    const AuthUser(
      id: 'u1',
      name: 'Ana',
      email: 'ana@rag.local',
      profiles: <String>[],
      permissions: <String>{},
      tenants: <TenantRef>[
        TenantRef(id: 'a', name: 'A'),
        TenantRef(id: 'b', name: 'B'),
      ],
    ),
  );
  return context;
}

void main() {
  group('ChatController', () {
    test('send adiciona a bolha do usuário e depois a do assistente', () async {
      final repo = FakeRagChatRepository(answer: _answer);
      final controller = ChatController(repo);

      await controller.send('pergunta');

      expect(controller.turns, hasLength(2));
      expect(controller.turns[0].role, ChatRole.user);
      expect(controller.turns[0].text, 'pergunta');
      expect(controller.turns[1].role, ChatRole.assistant);
      expect(controller.turns[1].text, 'O prazo é de 30 dias.');
      expect(controller.turns[1].citations[0].filename, 'regimento.pdf');
      expect(controller.conversationId, 'conv-1');
      expect(controller.isSending, isFalse);
      expect(repo.asked.single.question, 'pergunta');
      expect(repo.asked.single.conversationId, isNull);
    });

    test('bolha do usuário aparece antes da resposta', () async {
      final repo = _PendingChatRepository();
      final controller = ChatController(repo);

      final future = controller.send('pergunta');

      expect(controller.isSending, isTrue);
      expect(controller.turns.single.role, ChatRole.user);
      repo.pending.complete(_answer);
      await future;
      expect(controller.turns, hasLength(2));
    });

    test('o segundo send repassa o conversationId recebido', () async {
      final repo = FakeRagChatRepository(answer: _answer);
      final controller = ChatController(repo);

      await controller.send('primeira');
      await controller.send('segunda');

      expect(repo.asked, hasLength(2));
      expect(repo.asked[1].conversationId, 'conv-1');
    });

    test('newConversation limpa turns e conversationId', () async {
      final repo = FakeRagChatRepository(answer: _answer);
      final controller = ChatController(repo);

      await controller.send('primeira');
      controller.newConversation();

      expect(controller.turns, isEmpty);
      expect(controller.conversationId, isNull);

      await controller.send('depois');
      expect(repo.asked.last.conversationId, isNull);
    });

    test('send durante isSending não chama o repositório', () async {
      final repo = _PendingChatRepository();
      final controller = ChatController(repo);

      final first = controller.send('primeira');
      await controller.send('segunda');

      expect(repo.asked, hasLength(1));
      repo.pending.complete(_answer);
      await first;
    });

    test('pergunta vazia é ignorada', () async {
      final repo = FakeRagChatRepository(answer: _answer);
      final controller = ChatController(repo);

      await controller.send('   ');

      expect(repo.asked, isEmpty);
      expect(controller.turns, isEmpty);
    });

    test('AppException preenche errorMessage e zera isSending', () async {
      final repo = FakeRagChatRepository(
        failWith: const AppException(
          message: 'Falha ao consultar o provedor de LLM.',
          statusCode: 502,
        ),
      );
      final controller = ChatController(repo);

      await controller.send('pergunta');

      expect(controller.errorMessage, 'Falha ao consultar o provedor de LLM.');
      expect(controller.isSending, isFalse);
      expect(controller.turns.single.role, ChatRole.user);
    });
  });

  group('ChatController com TenantContext', () {
    test('troca de tenant sem a página montada descarta a conversa', () async {
      final tenants = await _tenants();
      final repo = FakeRagChatRepository(answer: _answer);
      final controller = ChatController(repo, tenants: tenants);

      await controller.send('no tenant a');
      await tenants.select('b');

      expect(controller.turns, isEmpty);
      expect(controller.conversationId, isNull);

      await controller.send('no tenant b');
      expect(repo.asked.last.conversationId, isNull);
      controller.dispose();
    });

    test('resposta que chega após a troca de tenant é descartada', () async {
      final tenants = await _tenants();
      final repo = _PendingChatRepository();
      final controller = ChatController(repo, tenants: tenants);

      final pending = controller.send('no tenant a');
      await tenants.select('b');

      expect(controller.turns, isEmpty);
      expect(controller.isSending, isFalse);

      repo.pending.complete(_answer);
      await pending;

      expect(controller.turns, isEmpty);
      expect(controller.conversationId, isNull);
      expect(controller.isSending, isFalse);
      controller.dispose();
    });

    test('logout (tenant nulo) descarta a conversa', () async {
      final tenants = await _tenants();
      final controller = ChatController(
        FakeRagChatRepository(answer: _answer),
        tenants: tenants,
      );

      await controller.send('pergunta');
      tenants.clear();

      expect(controller.turns, isEmpty);
      expect(controller.conversationId, isNull);
      controller.dispose();
    });
  });
}
