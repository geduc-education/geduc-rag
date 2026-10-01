import '../../../../shared/utils/cpf.dart';

/// Funcionário do tenant ativo — espelha o `EmployeeResponseDto`.
/// Serialização manual.
class EmployeeModel {
  const EmployeeModel({
    required this.id,
    required this.name,
    required this.email,
    required this.document,
    this.tenantId = '',
    this.userId,
    this.position,
    this.active = true,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String tenantId;

  /// Usuário da plataforma vinculado (`null` = sem vínculo).
  final String? userId;
  final String name;
  final String email;

  /// CPF só com os 11 dígitos, como o backend grava.
  final String document;
  final String? position;
  final bool active;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  /// CPF formatado `000.000.000-00` para exibição.
  String get formattedDocument => Cpf.format(document);

  /// Cargo para exibição ("Sem cargo" quando vazio).
  String get positionLabel {
    final value = position?.trim() ?? '';
    return value.isEmpty ? 'Sem cargo' : value;
  }

  factory EmployeeModel.fromJson(Map<String, dynamic> json) => EmployeeModel(
    id: json['id']?.toString() ?? '',
    tenantId: json['tenantId']?.toString() ?? '',
    userId: _nullableString(json['userId']),
    name: json['name']?.toString() ?? '',
    email: json['email']?.toString() ?? '',
    document: json['document']?.toString() ?? '',
    position: _nullableString(json['position']),
    active: json['active'] != false,
    createdAt: _date(json['createdAt']),
    updatedAt: _date(json['updatedAt']),
  );

  static String? _nullableString(Object? raw) => raw?.toString();

  static DateTime? _date(Object? raw) =>
      raw == null ? null : DateTime.tryParse(raw.toString());
}

/// Página da listagem (`{ data, total }`).
class EmployeesPage {
  const EmployeesPage({required this.items, required this.total});

  final List<EmployeeModel> items;
  final int total;

  factory EmployeesPage.fromJson(Map<String, dynamic> json) {
    final raw = json['data'];
    return EmployeesPage(
      items: raw is List
          ? raw
                .whereType<Map<String, dynamic>>()
                .map(EmployeeModel.fromJson)
                .toList(growable: false)
          : const <EmployeeModel>[],
      total: (json['total'] as num?)?.toInt() ?? 0,
    );
  }
}

/// Usuário da plataforma elegível para vínculo (`GET /users?tenantId=`).
class LinkableUser {
  const LinkableUser({
    required this.id,
    required this.name,
    required this.email,
  });

  final String id;
  final String name;
  final String email;

  String get label => email.isEmpty ? name : '$name ($email)';

  factory LinkableUser.fromJson(Map<String, dynamic> json) => LinkableUser(
    id: json['id']?.toString() ?? '',
    name: json['name']?.toString() ?? '',
    email: json['email']?.toString() ?? '',
  );

  /// Lê a lista do envelope paginado `{ data, total }`.
  static List<LinkableUser> listFromPage(Map<String, dynamic> json) {
    final raw = json['data'];
    return raw is List
        ? raw
              .whereType<Map<String, dynamic>>()
              .map(LinkableUser.fromJson)
              .toList(growable: false)
        : const <LinkableUser>[];
  }
}
