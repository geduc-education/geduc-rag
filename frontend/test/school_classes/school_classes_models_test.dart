import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/modules/school_classes/data/models/school_class_input.dart';
import 'package:geduc_rag/modules/school_classes/data/models/school_class_model.dart';

void main() {
  test('SchoolClassModel.fromJson lê o SchoolClassResponseDto', () {
    final schoolClass = SchoolClassModel.fromJson(const <String, dynamic>{
      'id': 'c1',
      'tenantId': 't1',
      'schoolId': 's1',
      'schoolName': 'EMEF Lobato',
      'schoolYear': 2026,
      'name': '8º A',
      'active': true,
      'createdAt': '2026-10-01T12:00:00.000Z',
    });
    expect(schoolClass.id, 'c1');
    expect(schoolClass.schoolId, 's1');
    expect(schoolClass.schoolYear, 2026);
    expect(schoolClass.name, '8º A');
    expect(schoolClass.description, 'EMEF Lobato · Ano letivo 2026');
    expect(schoolClass.createdAt, DateTime.utc(2026, 10, 1, 12));
  });

  test('fromJson tolera ano como texto e campos ausentes', () {
    final schoolClass = SchoolClassModel.fromJson(const <String, dynamic>{
      'schoolYear': '2027',
    });
    expect(schoolClass.schoolYear, 2027);
    expect(schoolClass.active, isTrue);
    expect(schoolClass.description, 'Ano letivo 2027');
  });

  test('SchoolClassesPage e SchoolOption leem o envelope paginado', () {
    final page = SchoolClassesPage.fromJson(const <String, dynamic>{
      'data': [
        {'id': 'c1', 'schoolYear': 2026, 'name': '8º A'},
      ],
      'total': 3,
    });
    expect(page.items.single.id, 'c1');
    expect(page.total, 3);

    final options = SchoolOption.listFromPage(const <String, dynamic>{
      'data': [
        {'id': 's1', 'name': 'A', 'active': false},
      ],
    });
    expect(options.single.label, 'A (inativa)');
  });

  test('inputs serializam criação completa e edição parcial', () {
    const create = CreateSchoolClassInput(
      schoolId: 's1',
      schoolYear: 2026,
      name: ' 8º A ',
    );
    expect(create.toJson(), {
      'schoolId': 's1',
      'schoolYear': 2026,
      'name': '8º A',
      'active': true,
    });
    expect(const UpdateSchoolClassInput(active: false).toJson(), {
      'active': false,
    });
  });
}
