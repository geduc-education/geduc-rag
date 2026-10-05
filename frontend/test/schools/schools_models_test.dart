import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/modules/schools/data/models/school_input.dart';
import 'package:geduc_rag/modules/schools/data/models/school_model.dart';

void main() {
  test('SchoolModel.fromJson lê o SchoolResponseDto', () {
    final school = SchoolModel.fromJson(const <String, dynamic>{
      'id': 's1',
      'tenantId': 't1',
      'name': 'EMEF Monteiro Lobato',
      'active': false,
      'createdAt': '2026-10-01T12:00:00.000Z',
      'updatedAt': '2026-10-02T12:00:00.000Z',
    });
    expect(school.id, 's1');
    expect(school.tenantId, 't1');
    expect(school.name, 'EMEF Monteiro Lobato');
    expect(school.active, isFalse);
    expect(school.createdAt, DateTime.utc(2026, 10, 1, 12));
  });

  test('fromJson tolera campos ausentes (ativo por padrão)', () {
    final school = SchoolModel.fromJson(const <String, dynamic>{});
    expect(school.id, '');
    expect(school.active, isTrue);
    expect(school.updatedAt, isNull);
  });

  test('SchoolsPage.fromJson lê o envelope { data, total }', () {
    final page = SchoolsPage.fromJson(const <String, dynamic>{
      'data': [
        {'id': 's1', 'name': 'A'},
        'lixo',
      ],
      'total': 7,
    });
    expect(page.items.single.id, 's1');
    expect(page.total, 7);
    expect(SchoolsPage.fromJson(const <String, dynamic>{}).items, isEmpty);
  });

  test('SchoolInput.toJson apara o nome', () {
    expect(const SchoolInput(name: '  Escola  ', active: false).toJson(), {
      'name': 'Escola',
      'active': false,
    });
  });
}
