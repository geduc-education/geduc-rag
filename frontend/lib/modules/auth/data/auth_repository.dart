import '../../../core/auth/auth_user.dart';
import '../../../core/http/api_client.dart';
import 'models/auth_response.dart';
import 'models/change_password_input.dart';
import 'models/login_input.dart';

/// Interface do repositório de autenticação — permite mockar nas camadas
/// superiores (controllers/serviço de sessão) sem depender do Dio.
abstract interface class IAuthRepository {
  Future<AuthResponse> login(LoginInput input);
  Future<AuthResponse> changePassword(ChangePasswordInput input);

  /// Rehidrata a sessão a partir do token persistido (`GET /auth/me`).
  Future<AuthUser> me();
}

/// Implementação HTTP do [IAuthRepository]. Erros já chegam normalizados
/// como `AppException` pelo [ApiClient].
class AuthRepository implements IAuthRepository {
  AuthRepository(this._client);

  final ApiClient _client;

  @override
  Future<AuthResponse> login(LoginInput input) async {
    final response = await _client.post<Map<String, dynamic>>(
      '/auth/login',
      data: input.toJson(),
    );
    return AuthResponse.fromJson(response.data ?? const <String, dynamic>{});
  }

  @override
  Future<AuthResponse> changePassword(ChangePasswordInput input) async {
    final response = await _client.post<Map<String, dynamic>>(
      '/auth/change-password',
      data: input.toJson(),
    );
    return AuthResponse.fromJson(response.data ?? const <String, dynamic>{});
  }

  @override
  Future<AuthUser> me() async {
    final response = await _client.get<Map<String, dynamic>>('/auth/me');
    return AuthUser.fromJson(response.data ?? const <String, dynamic>{});
  }
}
