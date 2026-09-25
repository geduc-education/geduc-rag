/// Payload de criação (`POST /users`). A senha é TEMPORÁRIA: o usuário nasce
/// com `mustChangePassword` e troca no 1º acesso. Perfis e tenants vão no
/// mesmo corpo (uma escrita só no backend).
class CreateUserInput {
  const CreateUserInput({
    required this.name,
    required this.email,
    required this.password,
    required this.profileIds,
    required this.tenantIds,
  });

  final String name;
  final String email;
  final String password;
  final List<String> profileIds;
  final List<String> tenantIds;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'name': name.trim(),
    'email': email.trim(),
    'password': password,
    'profileIds': profileIds,
    'tenantIds': tenantIds,
  };
}

/// Payload de edição (`PATCH /users/:id`). Campos `null` não vão no corpo;
/// `profileIds` substitui o conjunto inteiro. Tenants têm endpoint próprio.
class UpdateUserInput {
  const UpdateUserInput({this.name, this.email, this.profileIds});

  final String? name;
  final String? email;
  final List<String>? profileIds;

  Map<String, dynamic> toJson() => <String, dynamic>{
    if (name != null) 'name': name!.trim(),
    if (email != null) 'email': email!.trim(),
    if (profileIds != null) 'profileIds': profileIds,
  };
}
