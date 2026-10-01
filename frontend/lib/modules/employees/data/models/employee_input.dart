import '../../../../shared/utils/cpf.dart';

/// Valor de PATCH para coluna NULLABLE: distingue "não enviar" (o campo do
/// input é `null`) de "limpar" (`ClearableField(null)` envia `null`).
class ClearableField<T> {
  const ClearableField(this.value);

  final T? value;
}

/// Payload de criação (`POST /employees`). O tenant vem do header
/// `tenant-id` (injetado pelo `ApiClient`), nunca do corpo.
class CreateEmployeeInput {
  const CreateEmployeeInput({
    required this.name,
    required this.email,
    required this.document,
    this.position,
    this.userId,
    this.active = true,
  });

  final String name;
  final String email;

  /// CPF com ou sem pontuação — vai só com os dígitos.
  final String document;
  final String? position;
  final String? userId;
  final bool active;

  Map<String, dynamic> toJson() {
    final position = _trimmedOrNull(this.position);
    return <String, dynamic>{
      'name': name.trim(),
      'email': email.trim(),
      'document': Cpf.digits(document),
      'position': ?position,
      'userId': ?userId,
      'active': active,
    };
  }
}

/// Payload de edição (`PATCH /employees/:id`). Campos `null` não vão no
/// corpo. [position] e [userId] usam [ClearableField]: `ClearableField(null)`
/// envia `null` e limpa a coluna; os demais nunca vão como `null` (seria 400).
class UpdateEmployeeInput {
  const UpdateEmployeeInput({
    this.name,
    this.email,
    this.document,
    this.position,
    this.userId,
    this.active,
  });

  final String? name;
  final String? email;
  final String? document;
  final ClearableField<String>? position;
  final ClearableField<String>? userId;
  final bool? active;

  Map<String, dynamic> toJson() => <String, dynamic>{
    if (name != null) 'name': name!.trim(),
    if (email != null) 'email': email!.trim(),
    if (document != null) 'document': Cpf.digits(document),
    if (position != null) 'position': _trimmedOrNull(position!.value),
    if (userId != null) 'userId': userId!.value,
    if (active != null) 'active': active,
  };
}

/// Texto aparado; vazio vira `null` (cargo em branco = sem cargo).
String? _trimmedOrNull(String? value) {
  final trimmed = value?.trim() ?? '';
  return trimmed.isEmpty ? null : trimmed;
}
