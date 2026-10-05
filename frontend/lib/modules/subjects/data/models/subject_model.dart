/// Disciplina do tenant ativo — espelha o `SubjectResponseDto`.
/// Serialização manual.
class SubjectModel {
  const SubjectModel({
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

  factory SubjectModel.fromJson(Map<String, dynamic> json) => SubjectModel(
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
class SubjectsPage {
  const SubjectsPage({required this.items, required this.total});

  final List<SubjectModel> items;
  final int total;

  factory SubjectsPage.fromJson(Map<String, dynamic> json) {
    final raw = json['data'];
    return SubjectsPage(
      items: raw is List
          ? raw
                .whereType<Map<String, dynamic>>()
                .map(SubjectModel.fromJson)
                .toList(growable: false)
          : const <SubjectModel>[],
      total: (json['total'] as num?)?.toInt() ?? 0,
    );
  }
}
