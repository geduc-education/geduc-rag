import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/core/http/api_client.dart';
import 'package:geduc_rag/core/storage/secure_storage.dart';
import 'package:geduc_rag/modules/subjects/data/models/subject_input.dart';
import 'package:geduc_rag/modules/subjects/data/subjects_repository.dart';

class _FakeStorage extends SecureStorage {
  @override
  Future<String?> readToken() async => 'jwt';

  @override
  Future<void> clearToken() async {}
}

class _RecordingAdapter implements HttpClientAdapter {
  int status = 200;
  Object? body;
  final List<RequestOptions> requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return ResponseBody.fromString(
      body == null ? '' : jsonEncode(body),
      status,
      headers: <String, List<String>>{
        Headers.contentTypeHeader: <String>[Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

const Map<String, dynamic> _subjectJson = <String, dynamic>{
  'id': 's1',
  'tenantId': 't1',
  'name': 'Matemática',
  'active': true,
};

void main() {
  late _RecordingAdapter adapter;
  late SubjectsRepository repository;

  setUp(() {
    adapter = _RecordingAdapter();
    final client = ApiClient(_FakeStorage(), tenantIdProvider: () => 't1');
    client.dio.httpClientAdapter = adapter;
    repository = SubjectsRepository(client);
  });

  RequestOptions lastRequest() => adapter.requests.last;

  test('list envia filtros, limita a 100 e manda o tenant-id', () async {
    adapter.body = <String, dynamic>{
      'data': [_subjectJson],
      'total': 1,
    };
    final page = await repository.list(
      page: 2,
      limit: 500,
      search: ' lobato ',
      active: true,
    );
    final request = lastRequest();
    expect(request.method, 'GET');
    expect(request.path, '/subjects');
    expect(request.queryParameters, <String, dynamic>{
      'page': 2,
      'limit': 100,
      'search': 'lobato',
      'active': 'true',
    });
    expect(request.headers[ApiClient.tenantHeader], 't1');
    expect(page.items.single.name, 'Matemática');
  });

  test('create, update, getById e remove usam as rotas certas', () async {
    adapter
      ..status = 201
      ..body = _subjectJson;
    await repository.create(const SubjectInput(name: 'Mat'));
    expect(lastRequest().method, 'POST');
    expect(lastRequest().path, '/subjects');
    expect(lastRequest().data, <String, dynamic>{
      'name': 'Mat',
      'active': true,
    });

    adapter.status = 200;
    await repository.update('s1', const SubjectInput(name: 'X', active: false));
    expect(lastRequest().method, 'PATCH');
    expect(lastRequest().path, '/subjects/s1');

    final subject = await repository.getById('s1');
    expect(lastRequest().path, '/subjects/s1');
    expect(subject.id, 's1');

    adapter
      ..status = 204
      ..body = null;
    await repository.remove('s1');
    expect(lastRequest().method, 'DELETE');
    expect(lastRequest().path, '/subjects/s1');
  });

  test('nome duplicado vira AppException com o code', () async {
    adapter
      ..status = 409
      ..body = <String, dynamic>{
        'statusCode': 409,
        'code': 'SUBJECT_NAME_TAKEN',
        'message': 'Nome já usado.',
      };
    await expectLater(
      repository.create(const SubjectInput(name: 'Mat')),
      throwsA(
        isA<AppException>()
            .having((e) => e.statusCode, 'statusCode', 409)
            .having((e) => e.code, 'code', 'SUBJECT_NAME_TAKEN'),
      ),
    );
  });
}
