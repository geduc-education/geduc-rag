import 'package:flutter_test/flutter_test.dart';
import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/modules/changelog/data/changelog_repository.dart';
import 'package:geduc_rag/modules/changelog/data/models/changelog_entry.dart';
import 'package:geduc_rag/modules/changelog/presentation/changelog_controller.dart';

import '../support/fake_changelog_repository.dart';

ChangelogEntry _entry(ChangelogType type, int number) => ChangelogEntry(
  type: type,
  breaking: false,
  title: 'mudança $number',
  number: number,
  url: 'https://github.com/owner/repo/pull/$number',
  mergedAt: DateTime.utc(2026, 9, 28 - number),
);

final _mixed = <ChangelogEntry>[
  _entry(ChangelogType.refactor, 1),
  _entry(ChangelogType.feat, 2),
  _entry(ChangelogType.fix, 3),
  _entry(ChangelogType.feat, 4),
];

ChangelogFeed _feed(List<ChangelogEntry> items, {bool configured = true}) =>
    ChangelogFeed(configured: configured, items: items, stale: false);

const _sourceError = AppException(
  message: 'O GitHub não respondeu a tempo. Tente novamente em instantes.',
  statusCode: 502,
  code: 'CHANGELOG_SOURCE_UNAVAILABLE',
);

/// Lança uma exceção que não é `AppException`.
class _ThrowingRepository implements IChangelogRepository {
  @override
  Future<ChangelogFeed> fetch({int limit = 50}) async =>
      throw StateError('falha inesperada');
}

void main() {
  test('estado inicial é loading e hasLoaded falso', () {
    final c = ChangelogController(FakeChangelogRepository());
    expect(c.state, ChangelogViewState.loading);
    expect(c.hasLoaded, isFalse);
    expect(c.feed, isNull);
    expect(c.groups, isEmpty);
    expect(c.recent(3), isEmpty);
    expect(c.stale, isFalse);
  });

  test('feed não configurado leva a notConfigured', () async {
    final fake = FakeChangelogRepository(
      feed: _feed(const <ChangelogEntry>[], configured: false),
    );
    final c = ChangelogController(fake);
    await c.load();
    expect(c.state, ChangelogViewState.notConfigured);
    expect(c.hasLoaded, isTrue);
    expect(fake.calls, <int>[50]);
  });

  test('feed configurado sem itens leva a empty', () async {
    final c = ChangelogController(
      FakeChangelogRepository(feed: _feed(const <ChangelogEntry>[])),
    );
    await c.load();
    expect(c.state, ChangelogViewState.empty);
    expect(c.hasLoaded, isTrue);
  });

  test('feed com itens leva a ready e agrupa feat, fix, refactor', () async {
    final c = ChangelogController(FakeChangelogRepository(feed: _feed(_mixed)));
    await c.load();
    expect(c.state, ChangelogViewState.ready);
    expect(c.groups.map((g) => g.label).toList(), <String>[
      'Novas funcionalidades',
      'Correções',
      'Melhorias',
    ]);
    expect(c.groups.first.type, ChangelogType.feat);
    expect(c.groups.first.items.map((e) => e.number).toList(), <int>[2, 4]);
  });

  test('groups omite Melhorias quando não há refactor', () async {
    final c = ChangelogController(
      FakeChangelogRepository(
        feed: _feed(<ChangelogEntry>[
          _entry(ChangelogType.fix, 1),
          _entry(ChangelogType.feat, 2),
        ]),
      ),
    );
    await c.load();
    expect(c.groups.map((g) => g.label).toList(), <String>[
      'Novas funcionalidades',
      'Correções',
    ]);
  });

  test('recent(count) devolve os primeiros itens do feed', () async {
    final c = ChangelogController(FakeChangelogRepository(feed: _feed(_mixed)));
    await c.load();
    expect(c.recent(2), <ChangelogEntry>[_mixed[0], _mixed[1]]);
    expect(c.recent(10), hasLength(4));
  });

  test('ensureLoaded em sequência chama o repository uma vez', () async {
    final fake = FakeChangelogRepository(feed: _feed(_mixed));
    final c = ChangelogController(fake);
    await c.ensureLoaded();
    var notified = 0;
    c.addListener(() => notified++);
    await c.ensureLoaded();
    expect(fake.calls.length, 1);
    expect(notified, 0);
  });

  test('ensureLoaded simultâneos compartilham a mesma busca', () async {
    final fake = FakeChangelogRepository(feed: _feed(_mixed));
    final c = ChangelogController(fake);
    await Future.wait(<Future<void>>[c.ensureLoaded(), c.ensureLoaded()]);
    expect(fake.calls.length, 1);
    expect(c.state, ChangelogViewState.ready);
  });

  test('load simultâneos fazem uma chamada ao repository', () async {
    final fake = FakeChangelogRepository(feed: _feed(_mixed));
    final c = ChangelogController(fake);
    await Future.wait(<Future<void>>[c.load(), c.load()]);
    expect(fake.calls.length, 1);
  });

  test('AppException leva a error com a mensagem e hasLoaded falso', () async {
    final c = ChangelogController(
      FakeChangelogRepository(failWith: _sourceError),
    );
    await c.load();
    expect(c.state, ChangelogViewState.error);
    expect(c.error, _sourceError.message);
    expect(c.hasLoaded, isFalse);
  });

  test('outra exceção leva a error com mensagem genérica', () async {
    final c = ChangelogController(_ThrowingRepository());
    await c.load();
    expect(c.state, ChangelogViewState.error);
    expect(c.error, 'Não foi possível carregar as novidades.');
  });

  test('depois de erro, load e ensureLoaded buscam de novo', () async {
    final fake = FakeChangelogRepository(
      feed: _feed(_mixed),
      failWith: _sourceError,
    );
    final c = ChangelogController(fake);
    await c.ensureLoaded();
    expect(c.state, ChangelogViewState.error);

    fake.failWith = null;
    await c.ensureLoaded();
    expect(fake.calls.length, 2);
    expect(c.state, ChangelogViewState.ready);
    expect(c.hasLoaded, isTrue);

    await c.load();
    expect(fake.calls.length, 3);
    expect(c.state, ChangelogViewState.ready);
  });

  test('erro depois de carregar mantém hasLoaded verdadeiro', () async {
    final fake = FakeChangelogRepository(feed: _feed(_mixed));
    final c = ChangelogController(fake);
    await c.load();
    fake.failWith = _sourceError;
    await c.load();
    expect(c.state, ChangelogViewState.error);
    expect(c.hasLoaded, isTrue);
  });

  test('stale reflete o feed', () async {
    final c = ChangelogController(
      FakeChangelogRepository(
        feed: ChangelogFeed(configured: true, items: _mixed, stale: true),
      ),
    );
    await c.load();
    expect(c.stale, isTrue);
  });
}
