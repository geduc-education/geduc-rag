import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/core/http/api_client.dart';
import 'package:geduc_rag/core/storage/secure_storage.dart';
import 'package:geduc_rag/modules/academic_calendar/data/academic_calendar_repository.dart';
import 'package:geduc_rag/modules/academic_calendar/data/models/calendar_day.dart';
import 'package:geduc_rag/modules/academic_calendar/data/models/calendar_day_type.dart';

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

void main() {
  late _RecordingAdapter adapter;
  late AcademicCalendarRepository repository;

  setUp(() {
    adapter = _RecordingAdapter();
    final client = ApiClient(_FakeStorage(), tenantIdProvider: () => 't1');
    client.dio.httpClientAdapter = adapter;
    repository = AcademicCalendarRepository(client);
  });

  RequestOptions lastRequest() => adapter.requests.last;

  test('list envia filtros e o tenant-id', () async {
    adapter.body = <String, dynamic>{'data': <Object>[], 'total': 0};
    await repository.list(year: 2026, schoolId: 's1');
    final request = lastRequest();
    expect(request.path, '/academic-calendars');
    expect(request.queryParameters, <String, dynamic>{
      'page': 1,
      'limit': 100,
      'year': 2026,
      'schoolId': 's1',
    });
    expect(request.headers[ApiClient.tenantHeader], 't1');
  });

  test('listDays usa view e date no formato da API', () async {
    adapter.body = <String, dynamic>{
      'calendarId': 'c1',
      'view': 'month',
      'startDate': '2026-02-01',
      'endDate': '2026-02-28',
      'days': <Object>[],
      'totals': <String, dynamic>{'total': 0},
    };
    final period = await repository.listDays(
      'c1',
      view: CalendarView.month,
      date: DateTime(2026, 2, 4),
    );
    final request = lastRequest();
    expect(request.path, '/academic-calendars/c1/days');
    expect(request.queryParameters, <String, dynamic>{
      'view': 'month',
      'date': '2026-02-04',
    });
    expect(period.endDate, DateTime(2026, 2, 28));
  });

  test('updateDay faz PATCH /academic-calendars/:id/days/:date', () async {
    adapter.body = <String, dynamic>{
      'date': '2026-02-04',
      'weekday': 3,
      'type': 'OPTIONAL_DAY',
      'description': 'Carnaval',
    };
    final day = await repository.updateDay(
      'c1',
      DateTime(2026, 2, 4),
      const CalendarDayUpdate(
        type: CalendarDayType.optionalDay,
        description: 'Carnaval',
      ),
    );
    final request = lastRequest();
    expect(request.method, 'PATCH');
    expect(request.path, '/academic-calendars/c1/days/2026-02-04');
    expect(request.data, <String, dynamic>{
      'type': 'OPTIONAL_DAY',
      'description': 'Carnaval',
    });
    expect(day.type, CalendarDayType.optionalDay);
  });

  test('erro do backend vira AppException com o code', () async {
    adapter
      ..status = 400
      ..body = <String, dynamic>{
        'statusCode': 400,
        'code': 'CALENDAR_SUNDAY_IMMUTABLE',
        'message': 'Domingo é sempre não letivo.',
      };
    await expectLater(
      repository.updateDay(
        'c1',
        DateTime(2026, 2, 1),
        const CalendarDayUpdate(type: CalendarDayType.schoolDay),
      ),
      throwsA(
        isA<AppException>().having(
          (e) => e.code,
          'code',
          'CALENDAR_SUNDAY_IMMUTABLE',
        ),
      ),
    );
  });

  test('remove faz DELETE /academic-calendars/:id', () async {
    adapter.status = 204;
    await repository.remove('c1');
    expect(lastRequest().method, 'DELETE');
    expect(lastRequest().path, '/academic-calendars/c1');
  });
}
