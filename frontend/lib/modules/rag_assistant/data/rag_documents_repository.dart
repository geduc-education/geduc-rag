import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../../../core/http/api_client.dart';
import 'models/rag_document.dart';

/// Contrato do repositório de documentos do RAG (escopo do tenant ativo).
abstract interface class IRagDocumentsRepository {
  Future<RagDocumentPage> list({int page = 1, int limit = 20});

  /// Envia o arquivo em `multipart/form-data` (campo `file`) e devolve o
  /// `documentId` criado — a ingestão segue assíncrona (`202`).
  Future<String> upload({required String filename, required Uint8List bytes});
  Future<void> delete(String documentId);
}

class RagDocumentsRepository implements IRagDocumentsRepository {
  RagDocumentsRepository(this._client);

  final ApiClient _client;

  @override
  Future<RagDocumentPage> list({int page = 1, int limit = 20}) async {
    final response = await _client.get<Map<String, dynamic>>(
      '/documents',
      queryParameters: <String, dynamic>{'page': page, 'limit': limit},
    );
    return RagDocumentPage.fromJson(response.data ?? const <String, dynamic>{});
  }

  @override
  Future<String> upload({
    required String filename,
    required Uint8List bytes,
  }) async {
    final form = FormData.fromMap(<String, dynamic>{
      'file': MultipartFile.fromBytes(bytes, filename: filename),
    });
    final response = await _client.upload<Map<String, dynamic>>(
      '/documents',
      form,
    );
    return response.data?['documentId']?.toString() ?? '';
  }

  @override
  Future<void> delete(String documentId) =>
      _client.delete<void>('/documents/$documentId');
}
