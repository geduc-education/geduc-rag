/// Escola selecionável no filtro e no cadastro de registros do calendário.
class CalendarSchool {
  const CalendarSchool({required this.id, required this.name});

  factory CalendarSchool.fromJson(Map<String, dynamic> json) =>
      CalendarSchool(id: json['id'] as String, name: json['name'] as String);

  final String id;
  final String name;

  Map<String, dynamic> toJson() => <String, dynamic>{'id': id, 'name': name};
}
