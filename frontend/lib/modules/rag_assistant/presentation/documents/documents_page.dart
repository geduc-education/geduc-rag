import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_modular/flutter_modular.dart';

import '../../../../core/auth/app_permissions.dart';
import '../../../../core/auth/permission_service.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../shared/components/buttons/app_primary_button.dart';
import '../../../../shared/components/feedback/app_confirm_dialog.dart';
import '../../../../shared/components/feedback/app_state_views.dart';
import '../../../../shared/components/feedback/app_toast.dart';
import '../../../../shared/components/navigation/app_pager.dart';
import '../../data/models/rag_document.dart';
import '../rag_view_state.dart';
import 'documents_controller.dart';
import 'widgets/document_tile.dart';

/// Extensões aceitas pelo backend (`SUPPORTED_DOCUMENT_EXTENSIONS`).
const List<String> _allowedExtensions = <String>['md', 'txt', 'pdf', 'docx'];

/// Tela Documentos do assistente RAG: lista do tenant ativo com status da
/// ingestão (polling enquanto houver item em andamento), upload e exclusão.
/// Upload e exclusão só com `document:manage` — o backend é a autoridade.
class DocumentsPage extends StatefulWidget {
  const DocumentsPage({super.key});

  @override
  State<DocumentsPage> createState() => _DocumentsPageState();
}

class _DocumentsPageState extends State<DocumentsPage> {
  late final DocumentsController _controller;
  late final PermissionService _permissions;
  bool _uploading = false;

  @override
  void initState() {
    super.initState();
    _controller = inject<DocumentsController>();
    _permissions = inject<PermissionService>();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _controller.load();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  bool get _canManage => _permissions.can(AppPermissions.documentManage);

  void _toast(String? error, String success) {
    if (!mounted) return;
    showAppToast(
      context,
      error ?? success,
      type: error == null ? AppToastType.success : AppToastType.error,
    );
  }

  Future<void> _upload() async {
    final picked = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: _allowedExtensions,
    );
    if (picked.isEmpty || !mounted) return;
    final file = picked.first;
    setState(() => _uploading = true);
    String? error;
    try {
      error = await _controller.upload(file.name, await file.readAsBytes());
    } catch (_) {
      error = 'Não foi possível ler o arquivo selecionado.';
    }
    if (mounted) setState(() => _uploading = false);
    _toast(error, 'Documento enviado. A ingestão segue em segundo plano.');
  }

  Future<void> _delete(RagDocument document) async {
    final confirmed = await AppConfirmDialog.show(
      context,
      title: 'Excluir documento',
      message:
          'O documento "${document.filename}" e os trechos indexados dele '
          'serão excluídos. O assistente deixa de usá-lo nas respostas.',
      confirmLabel: 'Excluir',
      danger: true,
    );
    if (!confirmed) return;
    final error = await _controller.delete(document.documentId);
    _toast(error, 'Documento excluído.');
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) => Padding(
        padding: AppDimensions.paddingXl,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            if (_canManage)
              Align(
                alignment: Alignment.centerRight,
                child: AppPrimaryButton(
                  label: 'Enviar documento',
                  icon: Icons.upload_file_outlined,
                  loading: _uploading,
                  onPressed: _upload,
                ),
              ),
            AppDimensions.vGapLg,
            Expanded(
              child: _DocumentsBody(
                controller: _controller,
                onDelete: _canManage ? _delete : null,
              ),
            ),
            if (_controller.state == RagViewState.ready) ...<Widget>[
              AppDimensions.vGapMd,
              AppPager(
                label:
                    'Página ${_controller.page} de ${_controller.pageCount} · '
                    '${_controller.total} documento(s)',
                onPrevious: _controller.hasPrevious
                    ? _controller.previousPage
                    : null,
                onNext: _controller.hasNext ? _controller.nextPage : null,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Corpo da tela conforme o [RagViewState] do controller.
class _DocumentsBody extends StatelessWidget {
  const _DocumentsBody({required this.controller, required this.onDelete});

  final DocumentsController controller;
  final ValueChanged<RagDocument>? onDelete;

  @override
  Widget build(BuildContext context) {
    switch (controller.state) {
      case RagViewState.loading:
        return const AppLoadingView();
      case RagViewState.error:
        return AppErrorView(
          message: controller.errorMessage ?? 'Erro ao carregar.',
          onRetry: () => controller.load(page: controller.page),
        );
      case RagViewState.empty:
        return const AppEmptyView(
          message: 'Nenhum documento enviado neste tenant.',
          icon: Icons.description_outlined,
        );
      case RagViewState.ready:
        final delete = onDelete;
        return ListView.separated(
          itemCount: controller.items.length,
          separatorBuilder: (_, _) => AppDimensions.vGapSm,
          itemBuilder: (_, i) {
            final document = controller.items[i];
            return DocumentTile(
              document: document,
              onDelete: delete == null ? null : () => delete(document),
            );
          },
        );
    }
  }
}
