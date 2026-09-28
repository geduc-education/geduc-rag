import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/modules/changelog/data/models/changelog_entry.dart';

void main() {
  group('ChangelogFeed.fromJson', () {
    test('payload configurado descarta tipo fora do padrão', () {
      final feed = ChangelogFeed.fromJson(<String, dynamic>{
        'configured': true,
        'repository': 'owner/nome',
        'items': <dynamic>[
          <String, dynamic>{
            'type': 'feat',
            'scope': 'chat',
            'breaking': false,
            'title': 'cita trechos',
            'number': 42,
            'url': 'https://github.com/owner/nome/pull/42',
            'mergedAt': '2026-09-20T12:00:00Z',
          },
          <String, dynamic>{
            'type': 'chore',
            'scope': null,
            'breaking': false,
            'title': 'atualiza deps',
            'number': 43,
            'url': 'https://github.com/owner/nome/pull/43',
            'mergedAt': '2026-09-21T12:00:00Z',
          },
        ],
        'fetchedAt': '2026-09-28T16:00:00.000Z',
        'stale': false,
      });

      expect(feed.configured, isTrue);
      expect(feed.repository, 'owner/nome');
      expect(feed.stale, isFalse);
      expect(feed.fetchedAt, DateTime.utc(2026, 9, 28, 16));
      expect(feed.items, hasLength(1));
      final entry = feed.items.single;
      expect(entry.type, ChangelogType.feat);
      expect(entry.scope, 'chat');
      expect(entry.breaking, isFalse);
      expect(entry.title, 'cita trechos');
      expect(entry.number, 42);
      expect(entry.url, 'https://github.com/owner/nome/pull/42');
      expect(entry.mergedAt, DateTime.utc(2026, 9, 20, 12));
    });

    test('payload não configurado', () {
      final feed = ChangelogFeed.fromJson(<String, dynamic>{
        'configured': false,
        'repository': null,
        'items': <dynamic>[],
        'fetchedAt': null,
        'stale': false,
      });

      expect(feed.configured, isFalse);
      expect(feed.repository, isNull);
      expect(feed.items, isEmpty);
      expect(feed.fetchedAt, isNull);
    });
  });

  group('ChangelogEntry.tryFromJson', () {
    test('mergedAt inválido devolve null', () {
      final entry = ChangelogEntry.tryFromJson(<String, dynamic>{
        'type': 'fix',
        'title': 'x',
        'number': 1,
        'url': 'u',
        'mergedAt': 'não é data',
      });
      expect(entry, isNull);
    });
  });

  group('ChangelogType.parse', () {
    test('aceita os três tipos e rejeita o resto', () {
      expect(ChangelogType.parse('feat'), ChangelogType.feat);
      expect(ChangelogType.parse('fix'), ChangelogType.fix);
      expect(ChangelogType.parse('refactor'), ChangelogType.refactor);
      expect(ChangelogType.parse('chore'), isNull);
      expect(ChangelogType.parse(null), isNull);
    });
  });
}
