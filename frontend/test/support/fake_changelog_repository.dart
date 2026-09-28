import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/modules/changelog/data/changelog_repository.dart';
import 'package:geduc_rag/modules/changelog/data/models/changelog_entry.dart';

/// Repositório fake: registra o `limit` de cada chamada e devolve [feed]
/// (ou lança [failWith]).
class FakeChangelogRepository implements IChangelogRepository {
  FakeChangelogRepository({this.feed, this.failWith});

  ChangelogFeed? feed;
  AppException? failWith;

  final List<int> calls = <int>[];

  @override
  Future<ChangelogFeed> fetch({int limit = 50}) async {
    calls.add(limit);
    final error = failWith;
    if (error != null) throw error;
    return feed ??
        const ChangelogFeed(
          configured: true,
          items: <ChangelogEntry>[],
          stale: false,
        );
  }
}
