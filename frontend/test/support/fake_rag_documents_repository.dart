import 'dart:typed_data';

import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/modules/rag_assistant/data/models/rag_document.dart';
import 'package:geduc_rag/modules/rag_assistant/data/rag_documents_repository.dart';

/// Repositório fake de documentos: registra as chamadas e devolve dados fixos.
class FakeRagDocumentsRepository implements IRagDocumentsRepository {
  FakeRagDocumentsRepository({
    this.documents = const <RagDocument>[],
    this.total,
    this.uploadedId = 'new-doc',
    this.failWith,
  });

  List<RagDocument> documents;
  int? total;
  String uploadedId;
  AppException? failWith;

  final List<String> calls = <String>[];
  ({int page, int limit})? lastList;
  ({String filename, Uint8List bytes})? lastUpload;
  String? deletedId;

  void _maybeFail() {
    final error = failWith;
    if (error != null) throw error;
  }

  @override
  Future<RagDocumentPage> list({int page = 1, int limit = 20}) async {
    calls.add('list');
    lastList = (page: page, limit: limit);
    _maybeFail();
    return RagDocumentPage(data: documents, total: total ?? documents.length);
  }

  @override
  Future<String> upload({
    required String filename,
    required Uint8List bytes,
  }) async {
    calls.add('upload');
    lastUpload = (filename: filename, bytes: bytes);
    _maybeFail();
    return uploadedId;
  }

  @override
  Future<void> delete(String documentId) async {
    calls.add('delete');
    deletedId = documentId;
    _maybeFail();
  }
}
