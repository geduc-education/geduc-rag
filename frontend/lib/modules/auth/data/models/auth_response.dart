import '../../../../core/auth/auth_user.dart';

/// Resposta de autenticação (`/auth/login` e `/auth/change-password`): token de
/// acesso + usuário com perfis e permissões efetivas (união calculada no
/// backend). Serialização manual, padrão da casa.
class AuthResponse {
  const AuthResponse({required this.accessToken, required this.user});

  final String accessToken;
  final AuthUser user;

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    final rawUser = json['user'];
    return AuthResponse(
      accessToken: json['accessToken']?.toString() ?? '',
      user: rawUser is Map<String, dynamic>
          ? AuthUser.fromJson(rawUser)
          : const AuthUser(
              id: '',
              name: '',
              email: '',
              profiles: <String>[],
              permissions: <String>{},
            ),
    );
  }
}
