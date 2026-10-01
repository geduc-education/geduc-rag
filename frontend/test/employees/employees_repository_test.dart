import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/core/http/api_client.dart';
import 'package:geduc_rag/core/storage/secure_storage.dart';
import 'package:geduc_rag/modules/employees/data/employees_repository.dart';
import 'package:geduc_rag/modules/employees/data/models/employee_input.dart';

/// Storage sem plugin: devolve um JWT fixo.
class _FakeStorage extends SecureStorage {
  @override
  Future<String?> readToken() async => 'jwt';

  @override
  Future<void> clearToken() async {}
}

/// Adapter do Dio que registra a requisição e responde [status]/[body].
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

const Map<String, dynamic> _employeeJson = <String, dynamic>{
  'id': 'e1',
  'tenantId': 't1',
  'userId': null,
  'name': 'João',
  'email': 'joao@escola.com',
  'document': '12345678909',
  'position': 'Professor',
  'active': true,
  'createdAt': '2026-09-30T12:00:00.000Z',
  'updatedAt': '2026-09-30T12:00:00.000Z',
};

void main() {
  late _RecordingAdapter adapter;
  late EmployeesRepository repository;

  setUp(() {
    adapter = _RecordingAdapter();
    final client = ApiClient(_FakeStorage(), tenantIdProvider: () => 't1');
    client.dio.httpClientAdapter = adapter;
    repository = EmployeesRepository(client);
  });

  RequestOptions lastRequest() => adapter.requests.last;

  test('list envia filtros, limita a 100 e manda o tenant-id', () async {
    adapter.body = <String, dynamic>{
      'data': [_employeeJson],
      'total': 1,
    };
    final page = await repository.list(
      page: 2,
      limit: 500,
      search: ' joão ',
      active: false,
    );
    final request = lastRequest();
    expect(request.method, 'GET');
    expect(request.path, '/employees');
    expect(request.queryParameters, <String, dynamic>{
      'page': 2,
      'limit': 100,
      'search': 'joão',
      'active': 'false',
    });
    expect(request.headers[ApiClient.tenantHeader], 't1');
    expect(request.headers['Authorization'], 'Bearer jwt');
    expect(page.items.single.position, 'Professor');
  });

  test('list sem busca nem filtro não envia search/active', () async {
    adapter.body = <String, dynamic>{'data': <Object>[], 'total': 0};
    await repository.list();
    expect(lastRequest().queryParameters, <String, dynamic>{
      'page': 1,
      'limit': 20,
    });
  });

  test('create faz POST /employees com o corpo do input', () async {
    adapter
      ..status = 201
      ..body = _employeeJson;
    final created = await repository.create(
      const CreateEmployeeInput(
        name: 'João',
        email: 'joao@escola.com',
        document: '123.456.789-09',
        userId: 'u1',
      ),
    );
    final request = lastRequest();
    expect(request.method, 'POST');
    expect(request.path, '/employees');
    expect(request.data, <String, dynamic>{
      'name': 'João',
      'email': 'joao@escola.com',
      'document': '12345678909',
      'userId': 'u1',
      'active': true,
    });
    expect(created.id, 'e1');
  });

  test('update faz PATCH /employees/:id e pode limpar userId', () async {
    adapter.body = _employeeJson;
    await repository.update(
      'e1',
      const UpdateEmployeeInput(userId: ClearableField<String>(null)),
    );
    final request = lastRequest();
    expect(request.method, 'PATCH');
    expect(request.path, '/employees/e1');
    expect(request.data, <String, dynamic>{'userId': null});
  });

  test('getById faz GET /employees/:id', () async {
    adapter.body = _employeeJson;
    final employee = await repository.getById('e1');
    expect(lastRequest().path, '/employees/e1');
    expect(employee.email, 'joao@escola.com');
  });

  test('remove (soft) e purge (hard) usam rotas distintas', () async {
    adapter.status = 204;
    await repository.remove('e1');
    expect(lastRequest().method, 'DELETE');
    expect(lastRequest().path, '/employees/e1');

    await repository.purge('e1');
    expect(lastRequest().method, 'DELETE');
    expect(lastRequest().path, '/employees/e1/permanent');
  });

  test('listLinkableUsers filtra pelo tenant com limit 100', () async {
    adapter.body = <String, dynamic>{
      'data': [
        {'id': 'u1', 'name': 'Ana', 'email': 'ana@rag.local'},
      ],
      'total': 1,
    };
    final users = await repository.listLinkableUsers('t1');
    expect(lastRequest().path, '/users');
    expect(lastRequest().queryParameters, <String, dynamic>{
      'tenantId': 't1',
      'limit': 100,
    });
    expect(users.single.id, 'u1');
  });

  test('erro do backend vira AppException com o code', () async {
    adapter
      ..status = 409
      ..body = <String, dynamic>{
        'statusCode': 409,
        'code': 'EMPLOYEE_DOCUMENT_TAKEN',
        'message': 'CPF já cadastrado.',
      };
    await expectLater(
      repository.create(
        const CreateEmployeeInput(
          name: 'João',
          email: 'joao@escola.com',
          document: '12345678909',
        ),
      ),
      throwsA(
        isA<AppException>()
            .having((e) => e.statusCode, 'statusCode', 409)
            .having((e) => e.code, 'code', 'EMPLOYEE_DOCUMENT_TAKEN'),
      ),
    );
  });
}
