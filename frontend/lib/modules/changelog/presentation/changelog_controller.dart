import 'package:flutter/foundation.dart';

import '../../../core/errors/app_exception.dart';
import '../data/changelog_repository.dart';
import '../data/models/changelog_entry.dart';

/// Estado da tela de Novidades.
enum ChangelogViewState { loading, ready, empty, notConfigured, error }

/// Grupo de itens de um mesmo tipo, com o rótulo exibido na tela.
typedef ChangelogGroup = ({
  ChangelogType type,
  String label,
  List<ChangelogEntry> items,
});

/// Rótulos dos grupos, na ordem de exibição.
const Map<ChangelogType, String> changelogTypeLabels = {
  ChangelogType.feat: 'Novas funcionalidades',
  ChangelogType.fix: 'Correções',
  ChangelogType.refactor: 'Melhorias',
};

const String _genericError = 'Não foi possível carregar as novidades.';

/// Controller de Novidades. Singleton no escopo do shell: o card da tela de
/// início e a página dividem o mesmo feed. `ensureLoaded()` busca só na
/// primeira vez da sessão (e depois de erro); `load()` força a atualização.
/// Chamadas simultâneas compartilham a mesma busca.
class ChangelogController extends ChangeNotifier {
  ChangelogController(this._repository);

  final IChangelogRepository _repository;

  ChangelogViewState _state = ChangelogViewState.loading;
  String? _error;
  ChangelogFeed? _feed;
  List<ChangelogGroup> _groups = const <ChangelogGroup>[];
  bool _hasLoaded = false;
  Future<void>? _inFlight;

  ChangelogViewState get state => _state;
  String? get error => _error;
  ChangelogFeed? get feed => _feed;
  List<ChangelogGroup> get groups => _groups;
  bool get stale => _feed?.stale ?? false;
  bool get hasLoaded => _hasLoaded;

  /// Busca forçada; reaproveita a busca em andamento, se houver.
  Future<void> load() => _inFlight ??= _fetch().whenComplete(() {
    _inFlight = null;
  });

  /// Busca só se a sessão ainda não carregou o feed com sucesso.
  Future<void> ensureLoaded() {
    if (_hasLoaded) return Future<void>.value();
    return load();
  }

  /// Os [count] primeiros itens do feed (já ordenado por `mergedAt` desc).
  List<ChangelogEntry> recent(int count) =>
      _feed?.items.take(count).toList(growable: false) ??
      const <ChangelogEntry>[];

  Future<void> _fetch() async {
    _state = ChangelogViewState.loading;
    notifyListeners();
    try {
      _apply(await _repository.fetch());
    } on AppException catch (e) {
      _fail(e.message);
    } catch (_) {
      _fail(_genericError);
    }
    notifyListeners();
  }

  void _apply(ChangelogFeed feed) {
    _feed = feed;
    _groups = _groupByType(feed.items);
    _error = null;
    _hasLoaded = true;
    _state = _stateFor(feed);
  }

  void _fail(String message) {
    _error = message;
    _state = ChangelogViewState.error;
  }

  static ChangelogViewState _stateFor(ChangelogFeed feed) {
    if (!feed.configured) return ChangelogViewState.notConfigured;
    if (feed.items.isEmpty) return ChangelogViewState.empty;
    return ChangelogViewState.ready;
  }

  static List<ChangelogGroup> _groupByType(List<ChangelogEntry> items) {
    final groups = <ChangelogGroup>[];
    for (final MapEntry(key: type, value: label)
        in changelogTypeLabels.entries) {
      final ofType = items.where((e) => e.type == type).toList(growable: false);
      if (ofType.isNotEmpty) {
        groups.add((type: type, label: label, items: ofType));
      }
    }
    return List<ChangelogGroup>.unmodifiable(groups);
  }
}
