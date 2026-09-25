/// Configuração de ambiente do app.
///
/// `apiBaseUrl` pode ser sobrescrita em build via
/// `--dart-define=API_BASE_URL=...`. Default aponta para o backend local.
class AppConfig {
  const AppConfig._();

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000',
  );
}
