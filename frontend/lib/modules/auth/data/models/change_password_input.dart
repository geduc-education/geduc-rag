/// Payload de `POST /auth/change-password` (troca de senha obrigatória no 1º
/// acesso e troca voluntária).
class ChangePasswordInput {
  const ChangePasswordInput({
    required this.currentPassword,
    required this.newPassword,
    required this.confirmPassword,
  });

  final String currentPassword;
  final String newPassword;
  final String confirmPassword;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'currentPassword': currentPassword,
    'newPassword': newPassword,
    'confirmPassword': confirmPassword,
  };
}
