import '../../../core/http/api_client.dart';
import 'models/changelog_entry.dart';

/// Contrato do repositório de Novidades (`GET /changelog`).
abstract interface class IChangelogRepository {
  Future<ChangelogFeed> fetch({int limit = 50});
}

class ChangelogRepository implements IChangelogRepository {
  ChangelogRepository(this._client);

  final ApiClient _client;

  @override
  Future<ChangelogFeed> fetch({int limit = 50}) async {
    final response = await _client.get<Map<String, dynamic>>(
      '/changelog',
      queryParameters: <String, dynamic>{'limit': limit},
    );
    return ChangelogFeed.fromJson(response.data ?? const <String, dynamic>{});
  }
}
