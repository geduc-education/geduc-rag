import 'package:dio/dio.dart';

import '../config/app_config.dart';
import '../errors/app_exception.dart';
import '../storage/secure_storage.dart';

/// Único ponto de criação/configuração do `Dio` da plataforma.
///
/// Responsabilidades:
/// - injetar o JWT (lido do [SecureStorage]) em toda requisição;
/// - injetar o header `tenant-id` do tenant ativo ([tenantIdProvider]) — o
///   backend só o exige nas rotas do RAG, e o valida contra os vínculos;
/// - normalizar qualquer falha em [AppException] (mapeando o payload
///   `{code, message, details?}` do backend);
/// - tratar `401` centralmente: limpa o token e dispara [onUnauthorized]
///   (o boot registra aqui o redirect para o login), sem acoplar o cliente HTTP
///   ao roteamento;
/// - tratar `403 {code: 'PASSWORD_CHANGE_REQUIRED'}` centralmente: dispara
///   [onPasswordChangeRequired] para desviar à troca de senha obrigatória (o
///   backend rejeita toda rota autenticada nesse estado). `403` de permissão
///   comum (sem esse `code`) NÃO é tratado aqui — segue como `AppException`.
///
/// Nenhum repository deve instanciar `Dio` diretamente — todos recebem o
/// [ApiClient] e usam os helpers tipados abaixo.
class ApiClient {
  /// `code` do backend que sinaliza troca de senha obrigatória pendente.
  static const String passwordChangeRequiredCode = 'PASSWORD_CHANGE_REQUIRED';

  /// Header de tenant esperado pelo backend (`TENANT_HEADER`).
  static const String tenantHeader = 'tenant-id';

  ApiClient(this._storage, {String? Function()? tenantIdProvider})
    : _tenantIdProvider = tenantIdProvider,
      _dio = Dio(
        BaseOptions(
          baseUrl: AppConfig.apiBaseUrl,
          connectTimeout: const Duration(seconds: 20),
          receiveTimeout: const Duration(seconds: 30),
          contentType: 'application/json',
        ),
      ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _storage.readToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          final tenantId = _tenantIdProvider?.call();
          if (tenantId != null && tenantId.isNotEmpty) {
            options.headers[tenantHeader] = tenantId;
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          final status = error.response?.statusCode;
          if (status == 401) {
            await _storage.clearToken();
            _onUnauthorized?.call();
          } else if (status == 403 &&
              _isPasswordChangeRequired(error.response?.data)) {
            _onPasswordChangeRequired?.call();
          }
          handler.reject(
            DioException(
              requestOptions: error.requestOptions,
              error: AppException.fromDio(error),
              response: error.response,
              type: error.type,
            ),
          );
        },
      ),
    );
  }

  final Dio _dio;
  final SecureStorage _storage;
  final String? Function()? _tenantIdProvider;

  /// Callback disparado quando qualquer resposta retorna `401`. Registrado no
  /// boot (`AppRoot`) para levar ao login. `null` = ninguém escuta ainda.
  void Function()? _onUnauthorized;

  /// Callback disparado quando qualquer resposta retorna `403` com o `code`
  /// [passwordChangeRequiredCode]. Registrado no boot para desviar à troca de
  /// senha obrigatória. `null` = ninguém escuta ainda.
  void Function()? _onPasswordChangeRequired;

  /// Acesso direto ao `Dio` para casos avançados (download com progresso,
  /// `CancelToken`). Preferir os helpers tipados no caminho comum.
  Dio get dio => _dio;

  /// Registra o handler de sessão expirada/inválida (401). Idempotente.
  void setUnauthorizedHandler(void Function() handler) {
    _onUnauthorized = handler;
  }

  /// Registra o handler de troca de senha obrigatória pendente
  /// (`403 {code: 'PASSWORD_CHANGE_REQUIRED'}`). Idempotente.
  void setPasswordChangeRequiredHandler(void Function() handler) {
    _onPasswordChangeRequired = handler;
  }

  /// `true` quando o corpo de erro carrega o `code` de troca de senha exigida.
  bool _isPasswordChangeRequired(Object? data) =>
      data is Map && data['code'] == passwordChangeRequiredCode;

  // ---------------------------------------------------------------------------
  // Helpers tipados — capturam DioException e re-lançam AppException para a
  // camada de dados/apresentação tratar de forma uniforme.
  // ---------------------------------------------------------------------------

  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) => _guard(() => _dio.get<T>(path, queryParameters: queryParameters));

  Future<Response<T>> post<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
  }) => _guard(
    () => _dio.post<T>(path, data: data, queryParameters: queryParameters),
  );

  Future<Response<T>> patch<T>(String path, {Object? data}) =>
      _guard(() => _dio.patch<T>(path, data: data));

  Future<Response<T>> put<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
  }) => _guard(
    () => _dio.put<T>(path, data: data, queryParameters: queryParameters),
  );

  Future<Response<T>> delete<T>(String path, {Object? data}) =>
      _guard(() => _dio.delete<T>(path, data: data));

  /// Executa [request] e converte qualquer [DioException] em [AppException].
  Future<Response<T>> _guard<T>(Future<Response<T>> Function() request) async {
    try {
      return await request();
    } on DioException catch (error) {
      final normalized = error.error;
      if (normalized is AppException) throw normalized;
      throw AppException.fromDio(error);
    }
  }
}
