/// Payload de criação (`POST /school-classes`). Escola e ano letivo são
/// imutáveis depois de criados. O tenant vem do header `tenant-id`.
class CreateSchoolClassInput {
  const CreateSchoolClassInput({
    required this.schoolId,
    required this.schoolYear,
    required this.name,
    this.active = true,
  });

  final String schoolId;
  final int schoolYear;
  final String name;
  final bool active;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'schoolId': schoolId,
    'schoolYear': schoolYear,
    'name': name.trim(),
    'active': active,
  };
}

/// Payload de edição (`PATCH /school-classes/:id`) — só nome e situação.
/// Campos `null` não vão no corpo.
class UpdateSchoolClassInput {
  const UpdateSchoolClassInput({this.name, this.active});

  final String? name;
  final bool? active;

  Map<String, dynamic> toJson() => <String, dynamic>{
    if (name != null) 'name': name!.trim(),
    if (active != null) 'active': active,
  };
}
