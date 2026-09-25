import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Wrapper fino sobre `flutter_secure_storage`. Único ponto de leitura/escrita
/// do JWT — o token NUNCA vai para SharedPreferences.
class SecureStorage {
  SecureStorage([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  static const _tokenKey = 'auth_token';

  Future<String?> readToken() => _storage.read(key: _tokenKey);

  Future<void> writeToken(String token) =>
      _storage.write(key: _tokenKey, value: token);

  Future<void> clearToken() => _storage.delete(key: _tokenKey);
}
