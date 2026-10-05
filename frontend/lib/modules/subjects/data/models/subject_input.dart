/// Payload de criação/edição de disciplina (`POST /subjects` e
/// `PATCH /subjects/:id`). O tenant vem do header `tenant-id` (injetado pelo
/// `ApiClient`), nunca do corpo.
class SubjectInput {
  const SubjectInput({required this.name, this.active = true});

  final String name;
  final bool active;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'name': name.trim(),
    'active': active,
  };
}
