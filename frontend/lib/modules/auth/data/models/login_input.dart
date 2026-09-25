/// Payload de `POST /auth/login`.
class LoginInput {
  const LoginInput({required this.email, required this.password});

  final String email;
  final String password;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'email': email.trim(),
    'password': password,
  };
}
