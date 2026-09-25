/// Estado de processamento de um documento — espelha o `DocumentStatus` do
/// backend. Valor desconhecido vira [failed].
enum RagDocumentStatus {
  pending,
  processing,
  ready,
  failed;

  static RagDocumentStatus parse(Object? raw) {
    for (final status in values) {
      if (status.name == raw) return status;
    }
    return failed;
  }
}

/// Item de `GET /documents` — espelha o `DocumentSummary` do backend.
/// Serialização manual.
class RagDocument {
  const RagDocument({
    required this.documentId,
    required this.filename,
    required this.mimeType,
    required this.sizeBytes,
    required this.status,
    required this.createdAt,
    this.errorMessage,
  });

  final String documentId;
  final String filename;
  final String mimeType;
  final int sizeBytes;
  final RagDocumentStatus status;
  final String? errorMessage;
  final DateTime createdAt;

  /// Ainda na fila ou em ingestão (alvo do polling da tela).
  bool get isInProgress =>
      status == RagDocumentStatus.pending ||
      status == RagDocumentStatus.processing;

  factory RagDocument.fromJson(Map<String, dynamic> json) => RagDocument(
    documentId: json['documentId']?.toString() ?? '',
    filename: json['filename']?.toString() ?? '',
    mimeType: json['mimeType']?.toString() ?? '',
    sizeBytes: (json['sizeBytes'] as num?)?.toInt() ?? 0,
    status: RagDocumentStatus.parse(json['status']),
    errorMessage: json['errorMessage']?.toString(),
    createdAt:
        DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
        DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
  );
}

/// Página de `GET /documents` — `{ data, total }`.
class RagDocumentPage {
  const RagDocumentPage({required this.data, required this.total});

  final List<RagDocument> data;
  final int total;

  factory RagDocumentPage.fromJson(Map<String, dynamic> json) {
    final data = (json['data'] as List<dynamic>? ?? const <dynamic>[])
        .whereType<Map<String, dynamic>>()
        .map(RagDocument.fromJson)
        .toList(growable: false);
    return RagDocumentPage(
      data: data,
      total: (json['total'] as num?)?.toInt() ?? data.length,
    );
  }
}
