/// Escola do tenant (`GET /schools`), selecionável no filtro e no cadastro
/// do calendário.
class CalendarSchool {
  const CalendarSchool({
    required this.id,
    required this.name,
    this.active = true,
  });

  final String id;
  final String name;
  final bool active;

  /// Nome para exibição, marcando escolas inativas.
  String get label => active ? name : '$name (inativa)';

  factory CalendarSchool.fromJson(Map<String, dynamic> json) => CalendarSchool(
    id: json['id']?.toString() ?? '',
    name: json['name']?.toString() ?? '',
    active: json['active'] != false,
  );

  /// Lê a lista do envelope paginado `{ data, total }`.
  static List<CalendarSchool> listFromPage(Map<String, dynamic> json) {
    final raw = json['data'];
    return raw is List
        ? raw
              .whereType<Map<String, dynamic>>()
              .map(CalendarSchool.fromJson)
              .toList(growable: false)
        : const <CalendarSchool>[];
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'id': id,
    'name': name,
    'active': active,
  };
}
