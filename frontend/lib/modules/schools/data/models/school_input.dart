/// Payload de criação/edição de escola (`POST /schools` e
/// `PATCH /schools/:id`). O tenant vem do header `tenant-id` (injetado pelo
/// `ApiClient`), nunca do corpo.
class SchoolInput {
  const SchoolInput({required this.name, this.active = true});

  final String name;
  final bool active;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'name': name.trim(),
    'active': active,
  };
}
