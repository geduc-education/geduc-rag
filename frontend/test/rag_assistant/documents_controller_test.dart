import 'dart:typed_data';

import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/modules/rag_assistant/data/models/rag_document.dart';
import 'package:geduc_rag/modules/rag_assistant/presentation/documents/documents_controller.dart';
import 'package:geduc_rag/modules/rag_assistant/presentation/rag_view_state.dart';

import '../support/fake_rag_documents_repository.dart';

const _interval = Duration(seconds: 3);

RagDocument _doc(String id, RagDocumentStatus status) => RagDocument(
  documentId: id,
  filename: '$id.md',
  mimeType: 'text/markdown',
  sizeBytes: 10,
  status: status,
  createdAt: DateTime.utc(2026, 9, 25),
);

int _listCalls(FakeRagDocumentsRepository repo) =>
    repo.calls.where((c) => c == 'list').length;

void main() {
  test('item processing refaz o list a cada pollInterval até ficar ready e '
      'depois para', () {
    fakeAsync((async) {
      final repo = FakeRagDocumentsRepository(
        documents: [_doc('d1', RagDocumentStatus.processing)],
      );
      final controller = DocumentsController(repo, pollInterval: _interval);

      controller.load();
      async.flushMicrotasks();
      expect(_listCalls(repo), 1);
      expect(controller.state, RagViewState.ready);

      async.elapse(_interval);
      expect(_listCalls(repo), 2);
      async.elapse(_interval);
      expect(_listCalls(repo), 3);

      repo.documents = [_doc('d1', RagDocumentStatus.ready)];
      async.elapse(_interval);
      expect(_listCalls(repo), 4);
      expect(controller.items.single.status, RagDocumentStatus.ready);

      async.elapse(_interval * 3);
      expect(_listCalls(repo), 4);
      controller.dispose();
    });
  });

  test('para o polling após dispose', () {
    fakeAsync((async) {
      final repo = FakeRagDocumentsRepository(
        documents: [_doc('d1', RagDocumentStatus.processing)],
      );
      final controller = DocumentsController(repo, pollInterval: _interval);

      controller.load();
      async.flushMicrotasks();
      final before = _listCalls(repo);

      controller.dispose();
      async.elapse(_interval * 3);
      expect(_listCalls(repo), before);
    });
  });

  test('upload chama o repositório e recarrega a lista', () async {
    final repo = FakeRagDocumentsRepository(
      documents: [_doc('d1', RagDocumentStatus.ready)],
    );
    final controller = DocumentsController(repo, pollInterval: _interval);
    await controller.load();

    final bytes = Uint8List.fromList([1, 2, 3]);
    expect(await controller.upload('novo.md', bytes), isNull);
    expect(repo.lastUpload?.filename, 'novo.md');
    expect(repo.lastUpload?.bytes, bytes);
    expect(repo.calls, ['list', 'upload', 'list']);
    controller.dispose();
  });

  test('delete remove o item da lista', () async {
    final repo = FakeRagDocumentsRepository(
      documents: [
        _doc('d1', RagDocumentStatus.ready),
        _doc('d2', RagDocumentStatus.failed),
      ],
    );
    final controller = DocumentsController(repo, pollInterval: _interval);
    await controller.load();

    expect(await controller.delete('d1'), isNull);
    expect(repo.deletedId, 'd1');
    expect(controller.items.map((d) => d.documentId), ['d2']);
    expect(controller.total, 1);
    controller.dispose();
  });

  test('erro do repositório deixa o estado em error com a mensagem', () async {
    final repo = FakeRagDocumentsRepository(
      failWith: const AppException(message: 'Sem acesso', statusCode: 403),
    );
    final controller = DocumentsController(repo, pollInterval: _interval);
    await controller.load();

    expect(controller.state, RagViewState.error);
    expect(controller.errorMessage, 'Sem acesso');
    controller.dispose();
  });
}
