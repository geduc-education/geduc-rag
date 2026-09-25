import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../../core/errors/app_exception.dart';
import '../../data/models/rag_document.dart';
import '../../data/rag_documents_repository.dart';
import '../rag_view_state.dart';

/// Controller da tela Documentos: listagem paginada, upload, exclusão e
/// polling enquanto algum documento está na fila ou em ingestão.
class DocumentsController extends ChangeNotifier {
  DocumentsController(
    this._repository, {
    this.pollInterval = const Duration(seconds: 3),
    this.pageSize = 20,
  });

  final IRagDocumentsRepository _repository;
  final Duration pollInterval;
  final int pageSize;

  RagViewState _state = RagViewState.loading;
  String? _errorMessage;
  List<RagDocument> _items = const <RagDocument>[];
  int _total = 0;
  int _page = 1;
  Timer? _pollTimer;
  bool _disposed = false;

  RagViewState get state => _state;
  List<RagDocument> get items => _items;
  int get total => _total;
  String? get errorMessage => _errorMessage;
  int get page => _page;
  int get pageCount => _total == 0 ? 1 : ((_total - 1) ~/ pageSize) + 1;
  bool get hasPrevious => _page > 1;
  bool get hasNext => _page < pageCount;

  /// Carrega a [page] mostrando o estado de carregamento.
  Future<void> load({int page = 1}) async {
    _page = page;
    _state = RagViewState.loading;
    _notify();
    await _fetch();
  }

  Future<void> nextPage() async {
    if (hasNext) await load(page: _page + 1);
  }

  Future<void> previousPage() async {
    if (hasPrevious) await load(page: _page - 1);
  }

  /// Envia o arquivo e recarrega a página atual. `null` em sucesso; senão a
  /// mensagem de erro para o toast.
  Future<String?> upload(String filename, Uint8List bytes) => _run(() async {
    await _repository.upload(filename: filename, bytes: bytes);
    await _fetch();
  }, 'Não foi possível enviar o documento.');

  /// Exclui o documento e o remove da lista. `null` em sucesso; senão a
  /// mensagem de erro para o toast.
  Future<String?> delete(String documentId) => _run(() async {
    await _repository.delete(documentId);
    final before = _items.length;
    _items = <RagDocument>[
      for (final d in _items)
        if (d.documentId != documentId) d,
    ];
    _total -= before - _items.length;
    if (_items.isEmpty) _state = RagViewState.empty;
    _notify();
  }, 'Não foi possível excluir o documento.');

  /// Busca a página sem passar por `loading` (usado também pelo polling).
  Future<void> _fetch() async {
    _pollTimer?.cancel();
    try {
      final result = await _repository.list(page: _page, limit: pageSize);
      _items = result.data;
      _total = result.total;
      _errorMessage = null;
      _state = _items.isEmpty ? RagViewState.empty : RagViewState.ready;
    } on AppException catch (e) {
      _fail(e.message);
    } catch (_) {
      _fail('Não foi possível carregar os documentos.');
    }
    _schedulePoll();
    _notify();
  }

  void _fail(String message) {
    _errorMessage = message;
    _state = RagViewState.error;
  }

  /// Agenda o próximo `list` só enquanto algum item está em andamento.
  void _schedulePoll() {
    if (_disposed || _state != RagViewState.ready) return;
    if (!_items.any((d) => d.isInProgress)) return;
    _pollTimer = Timer(pollInterval, _fetch);
  }

  Future<String?> _run(Future<void> Function() action, String fallback) async {
    try {
      await action();
      return null;
    } on AppException catch (e) {
      return e.message;
    } catch (_) {
      return fallback;
    }
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _pollTimer?.cancel();
    _pollTimer = null;
    super.dispose();
  }
}
