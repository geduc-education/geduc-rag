import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/modules/subjects/data/models/subject_input.dart';
import 'package:geduc_rag/modules/subjects/data/models/subject_model.dart';

void main() {
  test('SubjectModel.fromJson lê o SubjectResponseDto', () {
    final subject = SubjectModel.fromJson(const <String, dynamic>{
      'id': 's1',
      'tenantId': 't1',
      'name': 'Matemática',
      'active': false,
      'createdAt': '2026-10-01T12:00:00.000Z',
      'updatedAt': '2026-10-02T12:00:00.000Z',
    });
    expect(subject.id, 's1');
    expect(subject.tenantId, 't1');
    expect(subject.name, 'Matemática');
    expect(subject.active, isFalse);
    expect(subject.createdAt, DateTime.utc(2026, 10, 1, 12));
  });

  test('fromJson tolera campos ausentes (ativo por padrão)', () {
    final subject = SubjectModel.fromJson(const <String, dynamic>{});
    expect(subject.id, '');
    expect(subject.active, isTrue);
    expect(subject.updatedAt, isNull);
  });

  test('SubjectsPage.fromJson lê o envelope { data, total }', () {
    final page = SubjectsPage.fromJson(const <String, dynamic>{
      'data': [
        {'id': 's1', 'name': 'A'},
        'lixo',
      ],
      'total': 7,
    });
    expect(page.items.single.id, 's1');
    expect(page.total, 7);
    expect(SubjectsPage.fromJson(const <String, dynamic>{}).items, isEmpty);
  });

  test('SubjectInput.toJson apara o nome', () {
    expect(const SubjectInput(name: '  Disciplina  ', active: false).toJson(), {
      'name': 'Disciplina',
      'active': false,
    });
  });
}
