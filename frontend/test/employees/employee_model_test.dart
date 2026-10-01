import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/modules/employees/data/models/employee_input.dart';
import 'package:geduc_rag/modules/employees/data/models/employee_model.dart';
import 'package:geduc_rag/shared/utils/cpf.dart';

void main() {
  group('EmployeeModel', () {
    test('EmployeesPage.fromJson lê o envelope e os campos nulos', () {
      final page = EmployeesPage.fromJson(<String, dynamic>{
        'total': 7,
        'data': [
          {
            'id': 'e1',
            'tenantId': 't1',
            'userId': null,
            'name': 'João',
            'email': 'joao@escola.com',
            'document': '12345678909',
            'position': null,
            'active': false,
            'createdAt': '2026-09-30T12:00:00.000Z',
            'updatedAt': '2026-09-30T13:00:00.000Z',
          },
        ],
      });
      final employee = page.items.single;
      expect(page.total, 7);
      expect(employee.userId, isNull);
      expect(employee.position, isNull);
      expect(employee.positionLabel, 'Sem cargo');
      expect(employee.active, isFalse);
      expect(employee.formattedDocument, '123.456.789-09');
      expect(employee.createdAt, DateTime.utc(2026, 9, 30, 12));
    });

    test('LinkableUser.listFromPage lê {data, total}', () {
      final users = LinkableUser.listFromPage(<String, dynamic>{
        'total': 1,
        'data': [
          {'id': 'u1', 'name': 'Ana', 'email': 'ana@rag.local'},
        ],
      });
      expect(users.single.label, 'Ana (ana@rag.local)');
    });
  });

  group('inputs', () {
    test('CreateEmployeeInput envia CPF só com dígitos e omite vazios', () {
      const input = CreateEmployeeInput(
        name: ' João ',
        email: 'joao@escola.com ',
        document: '123.456.789-09',
        position: '   ',
      );
      expect(input.toJson(), <String, dynamic>{
        'name': 'João',
        'email': 'joao@escola.com',
        'document': '12345678909',
        'active': true,
      });
    });

    test('UpdateEmployeeInput: ClearableField(null) envia null', () {
      const input = UpdateEmployeeInput(
        position: ClearableField<String>(''),
        userId: ClearableField<String>(null),
      );
      expect(input.toJson(), <String, dynamic>{
        'position': null,
        'userId': null,
      });
    });

    test('UpdateEmployeeInput omite campos não informados', () {
      const input = UpdateEmployeeInput(name: 'Ana', active: false);
      expect(input.toJson(), <String, dynamic>{'name': 'Ana', 'active': false});
    });
  });

  group('Cpf', () {
    test('format e digits', () {
      expect(Cpf.format('12345678909'), '123.456.789-09');
      expect(Cpf.format('1234'), '123.4');
      expect(Cpf.digits('123.456.789-09'), '12345678909');
    });

    test('validate exige 11 dígitos', () {
      expect(Cpf.validate(''), 'CPF é obrigatório.');
      expect(Cpf.validate('123.456.789-0'), 'O CPF deve ter 11 dígitos.');
      expect(Cpf.validate('123.456.789-09'), isNull);
    });

    test('CpfInputFormatter mascara e corta no 11º dígito', () {
      const formatter = CpfInputFormatter();
      final value = formatter.formatEditUpdate(
        TextEditingValue.empty,
        const TextEditingValue(text: '123456789099999'),
      );
      expect(value.text, '123.456.789-09');
    });
  });
}
