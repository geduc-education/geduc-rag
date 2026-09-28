/// Tipo de mudança exibido em Novidades — espelha o `ChangelogType` do
/// backend. Valor fora do conjunto vira `null` (o item é descartado).
enum ChangelogType {
  feat,
  fix,
  refactor;

  static ChangelogType? parse(String? raw) {
    for (final type in values) {
      if (type.name == raw) return type;
    }
    return null;
  }
}

/// Item de `GET /changelog` — um PR mergeado com título no padrão
/// Conventional Commits. Serialização manual.
class ChangelogEntry {
  const ChangelogEntry({
    required this.type,
    required this.breaking,
    required this.title,
    required this.number,
    required this.url,
    required this.mergedAt,
    this.scope,
  });

  final ChangelogType type;
  final String? scope;
  final bool breaking;
  final String title;
  final int number;
  final String url;
  final DateTime mergedAt;

  /// Devolve `null` quando `type` ou `mergedAt` não parseiam.
  static ChangelogEntry? tryFromJson(Map<String, dynamic> json) {
    final type = ChangelogType.parse(json['type']?.toString());
    final mergedAt = DateTime.tryParse(json['mergedAt']?.toString() ?? '');
    if (type == null || mergedAt == null) return null;
    return ChangelogEntry(
      type: type,
      scope: json['scope']?.toString(),
      breaking: json['breaking'] == true,
      title: json['title']?.toString() ?? '',
      number: (json['number'] as num?)?.toInt() ?? 0,
      url: json['url']?.toString() ?? '',
      mergedAt: mergedAt,
    );
  }
}

/// Resposta de `GET /changelog`. `configured == false` quando o backend não
/// tem `GITHUB_REPO`; `stale == true` quando o cache vencido foi servido
/// porque o GitHub falhou.
class ChangelogFeed {
  const ChangelogFeed({
    required this.configured,
    required this.items,
    required this.stale,
    this.repository,
    this.fetchedAt,
  });

  final bool configured;
  final String? repository;
  final List<ChangelogEntry> items;
  final DateTime? fetchedAt;
  final bool stale;

  /// Descarta itens inválidos e mantém a ordem da API.
  factory ChangelogFeed.fromJson(Map<String, dynamic> json) {
    final items = (json['items'] as List<dynamic>? ?? const <dynamic>[])
        .whereType<Map<String, dynamic>>()
        .map(ChangelogEntry.tryFromJson)
        .whereType<ChangelogEntry>()
        .toList(growable: false);
    return ChangelogFeed(
      configured: json['configured'] == true,
      repository: json['repository']?.toString(),
      items: items,
      fetchedAt: DateTime.tryParse(json['fetchedAt']?.toString() ?? ''),
      stale: json['stale'] == true,
    );
  }
}
