import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/core/http/api_client.dart';
import 'package:geduc_rag/core/storage/secure_storage.dart';
import 'package:geduc_rag/modules/school_classes/data/models/school_class_input.dart';
import 'package:geduc_rag/modules/school_classes/data/school_classes_repository.dart';

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

const Map<String, dynamic> _classJson = <String, dynamic>{
  'id': 'c1',
  'tenantId': 't1',
  'schoolId': 's1',
  'schoolName': 'EMEF',
  'schoolYear': 2026,
  'name': '8º A',
  'active': true,
};

void main() {
  late _RecordingAdapter adapter;
  late SchoolClassesRepository repository;

  setUp(() {
    adapter = _RecordingAdapter();
    final client = ApiClient(_FakeStorage(), tenantIdProvider: () => 't1');
    client.dio.httpClientAdapter = adapter;
    repository = SchoolClassesRepository(client);
  });

  RequestOptions lastRequest() => adapter.requests.last;

  test('list envia filtros de escola/ano/status e o tenant-id', () async {
    adapter.body = <String, dynamic>{
      'data': [_classJson],
      'total': 1,
    };
    final page = await repository.list(
      const SchoolClassQuery(
        page: 2,
        limit: 500,
        search: ' 8º ',
        active: false,
        schoolId: 's1',
        schoolYear: 2026,
      ),
    );
    final request = lastRequest();
    expect(request.path, '/school-classes');
    expect(request.queryParameters, <String, dynamic>{
      'page': 2,
      'limit': 100,
      'search': '8º',
      'active': 'false',
      'schoolId': 's1',
      'schoolYear': 2026,
    });
    expect(request.headers[ApiClient.tenantHeader], 't1');
    expect(page.items.single.schoolName, 'EMEF');
  });

  test('list sem filtros envia só a paginação', () async {
    adapter.body = <String, dynamic>{'data': <Object>[], 'total': 0};
    await repository.list();
    expect(lastRequest().queryParameters, <String, dynamic>{
      'page': 1,
      'limit': 20,
    });
  });

  test('create/update/remove usam as rotas e corpos certos', () async {
    adapter
      ..status = 201
      ..body = _classJson;
    await repository.create(
      const CreateSchoolClassInput(
        schoolId: 's1',
        schoolYear: 2026,
        name: '8º A',
      ),
    );
    expect(lastRequest().method, 'POST');
    expect(lastRequest().data, containsPair('schoolYear', 2026));

    adapter.status = 200;
    await repository.update('c1', const UpdateSchoolClassInput(name: '8º B'));
    expect(lastRequest().method, 'PATCH');
    expect(lastRequest().path, '/school-classes/c1');
    expect(lastRequest().data, <String, dynamic>{'name': '8º B'});

    adapter
      ..status = 204
      ..body = null;
    await repository.remove('c1');
    expect(lastRequest().method, 'DELETE');
    expect(lastRequest().path, '/school-classes/c1');
  });

  test('listSchoolOptions consulta /schools com limit 100', () async {
    adapter.body = <String, dynamic>{
      'data': [
        {'id': 's1', 'name': 'EMEF', 'active': true},
      ],
      'total': 1,
    };
    final options = await repository.listSchoolOptions(active: true);
    expect(lastRequest().path, '/schools');
    expect(lastRequest().queryParameters, <String, dynamic>{
      'limit': 100,
      'active': 'true',
    });
    expect(options.single.id, 's1');
  });

  test('escola inválida vira AppException com o code', () async {
    adapter
      ..status = 400
      ..body = <String, dynamic>{
        'statusCode': 400,
        'code': 'SCHOOL_CLASS_SCHOOL_INVALID',
        'message': 'Escola inválida.',
      };
    await expectLater(
      repository.create(
        const CreateSchoolClassInput(
          schoolId: 'x',
          schoolYear: 2026,
          name: 'A',
        ),
      ),
      throwsA(
        isA<AppException>().having(
          (e) => e.code,
          'code',
          'SCHOOL_CLASS_SCHOOL_INVALID',
        ),
      ),
    );
  });
}
