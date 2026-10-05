/// Escola do tenant ativo — espelha o `SchoolResponseDto`.
/// Serialização manual.
class SchoolModel {
  const SchoolModel({
    required this.id,
    required this.name,
    this.tenantId = '',
    this.active = true,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String tenantId;
  final String name;
  final bool active;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory SchoolModel.fromJson(Map<String, dynamic> json) => SchoolModel(
    id: json['id']?.toString() ?? '',
    tenantId: json['tenantId']?.toString() ?? '',
    name: json['name']?.toString() ?? '',
    active: json['active'] != false,
    createdAt: _date(json['createdAt']),
    updatedAt: _date(json['updatedAt']),
  );

  static DateTime? _date(Object? raw) =>
      raw == null ? null : DateTime.tryParse(raw.toString());
}

/// Página da listagem (`{ data, total }`).
class SchoolsPage {
  const SchoolsPage({required this.items, required this.total});

  final List<SchoolModel> items;
  final int total;

  factory SchoolsPage.fromJson(Map<String, dynamic> json) {
    final raw = json['data'];
    return SchoolsPage(
      items: raw is List
          ? raw
                .whereType<Map<String, dynamic>>()
                .map(SchoolModel.fromJson)
                .toList(growable: false)
          : const <SchoolModel>[],
      total: (json['total'] as num?)?.toInt() ?? 0,
    );
  }
}
