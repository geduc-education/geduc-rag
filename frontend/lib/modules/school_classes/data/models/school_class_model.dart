/// Turma do tenant ativo — espelha o `SchoolClassResponseDto`.
/// Serialização manual.
class SchoolClassModel {
  const SchoolClassModel({
    required this.id,
    required this.schoolId,
    required this.schoolYear,
    required this.name,
    this.tenantId = '',
    this.schoolName = '',
    this.active = true,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String tenantId;
  final String schoolId;
  final String schoolName;
  final int schoolYear;
  final String name;
  final bool active;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  /// Subtítulo da listagem: "Escola · Ano letivo 2026".
  String get description => schoolName.isEmpty
      ? 'Ano letivo $schoolYear'
      : '$schoolName · Ano letivo $schoolYear';

  factory SchoolClassModel.fromJson(Map<String, dynamic> json) =>
      SchoolClassModel(
        id: json['id']?.toString() ?? '',
        tenantId: json['tenantId']?.toString() ?? '',
        schoolId: json['schoolId']?.toString() ?? '',
        schoolName: json['schoolName']?.toString() ?? '',
        schoolYear: _int(json['schoolYear']),
        name: json['name']?.toString() ?? '',
        active: json['active'] != false,
        createdAt: _date(json['createdAt']),
        updatedAt: _date(json['updatedAt']),
      );

  static int _int(Object? raw) => switch (raw) {
    final num value => value.toInt(),
    final String value => int.tryParse(value) ?? 0,
    _ => 0,
  };

  static DateTime? _date(Object? raw) =>
      raw == null ? null : DateTime.tryParse(raw.toString());
}

/// Página da listagem (`{ data, total }`).
class SchoolClassesPage {
  const SchoolClassesPage({required this.items, required this.total});

  final List<SchoolClassModel> items;
  final int total;

  factory SchoolClassesPage.fromJson(Map<String, dynamic> json) {
    final raw = json['data'];
    return SchoolClassesPage(
      items: raw is List
          ? raw
                .whereType<Map<String, dynamic>>()
                .map(SchoolClassModel.fromJson)
                .toList(growable: false)
          : const <SchoolClassModel>[],
      total: (json['total'] as num?)?.toInt() ?? 0,
    );
  }
}

/// Escola elegível no seletor/filtro de turmas (`GET /schools`).
class SchoolOption {
  const SchoolOption({
    required this.id,
    required this.name,
    this.active = true,
  });

  final String id;
  final String name;
  final bool active;

  /// Rótulo do seletor; escola inativa vem sinalizada.
  String get label => active ? name : '$name (inativa)';

  factory SchoolOption.fromJson(Map<String, dynamic> json) => SchoolOption(
    id: json['id']?.toString() ?? '',
    name: json['name']?.toString() ?? '',
    active: json['active'] != false,
  );

  /// Lê a lista do envelope paginado `{ data, total }`.
  static List<SchoolOption> listFromPage(Map<String, dynamic> json) {
    final raw = json['data'];
    return raw is List
        ? raw
              .whereType<Map<String, dynamic>>()
              .map(SchoolOption.fromJson)
              .toList(growable: false)
        : const <SchoolOption>[];
  }
}
