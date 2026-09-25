import 'package:dio/dio.dart';

/// Exceção normalizada da aplicação. Toda falha HTTP capturada nos repositories
/// é convertida em `AppException` para a camada de apresentação tratar de forma
/// uniforme. Espelha o contrato de erro do backend
/// (`{ statusCode, message, code?, details? }`).
class AppException implements Exception {
  const AppException({
    required this.message,
    this.statusCode,
    this.code,
    this.details,
  });

  final String message;
  final int? statusCode;
  final String? code;
  final Map<String, dynamic>? details;

  /// Constrói uma `AppException` a partir de um erro do Dio, extraindo o corpo
  /// de erro padronizado do backend quando disponível.
  factory AppException.fromDio(DioException error) {
    final response = error.response;
    final data = response?.data;

    if (data is Map<String, dynamic>) {
      final rawMessage = data['message'];
      final message = rawMessage is List
          ? rawMessage.join(', ')
          : rawMessage?.toString();
      return AppException(
        message: message ?? 'Erro de comunicação com o servidor.',
        statusCode: response?.statusCode,
        code: data['code']?.toString(),
        details: data['details'] as Map<String, dynamic>?,
      );
    }

    return AppException(
      message: 'Erro de comunicação com o servidor.',
      statusCode: response?.statusCode,
    );
  }

  @override
  String toString() => 'AppException($statusCode, $code): $message';
}
