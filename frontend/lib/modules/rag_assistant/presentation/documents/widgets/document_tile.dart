import 'package:flutter/material.dart';

import '../../../../../core/theme/app_dimensions.dart';
import '../../../../../core/theme/app_text_styles.dart';
import '../../../../../core/theme/colors_app.dart';
import '../../../../../shared/utils/app_date_formats.dart';
import '../../../data/models/rag_document.dart';

/// Item da lista de documentos: nome, metadados, chip de status e, em
/// `failed`, o motivo da falha. Excluir só aparece com [onDelete].
class DocumentTile extends StatelessWidget {
  const DocumentTile({super.key, required this.document, this.onDelete});

  final RagDocument document;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: AppDimensions.paddingLg,
      decoration: BoxDecoration(
        color: colors.surfaceCard,
        borderRadius: AppDimensions.borderRadius,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Row(
        children: <Widget>[
          Icon(Icons.description_outlined, color: colors.textSecondary),
          AppDimensions.hGapMd,
          Expanded(child: _DocumentInfo(document: document)),
          if (onDelete != null)
            IconButton(
              tooltip: 'Excluir',
              icon: Icon(Icons.delete_outline, color: colors.danger500),
              onPressed: onDelete,
            ),
        ],
      ),
    );
  }
}

class _DocumentInfo extends StatelessWidget {
  const _DocumentInfo({required this.document});

  final RagDocument document;

  String get _meta =>
      '${_formatSize(document.sizeBytes)} · '
      '${formatDateTime(document.createdAt.toLocal())}';

  static String _formatSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final error = document.errorMessage;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            Flexible(
              child: Text(
                document.filename,
                style: context.textStyles.textRegularBold.copyWith(
                  color: colors.textPrimary,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            AppDimensions.hGapSm,
            _StatusChip(status: document.status),
          ],
        ),
        Text(
          _meta,
          style: context.textStyles.textSmall.copyWith(color: colors.textMuted),
        ),
        if (document.status == RagDocumentStatus.failed && error != null)
          Text(
            error,
            style: context.textStyles.textSmall.copyWith(
              color: colors.danger700,
            ),
          ),
      ],
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});

  final RagDocumentStatus status;

  static String _label(RagDocumentStatus status) => switch (status) {
    RagDocumentStatus.pending => 'Na fila',
    RagDocumentStatus.processing => 'Processando',
    RagDocumentStatus.ready => 'Pronto',
    RagDocumentStatus.failed => 'Falhou',
  };

  static (Color, Color) _palette(ColorsApp colors, RagDocumentStatus status) =>
      switch (status) {
        RagDocumentStatus.pending => (colors.neutral200, colors.neutral600),
        RagDocumentStatus.processing => (colors.info50, colors.info700),
        RagDocumentStatus.ready => (colors.success50, colors.success700),
        RagDocumentStatus.failed => (colors.danger50, colors.danger700),
      };

  @override
  Widget build(BuildContext context) {
    final (background, foreground) = _palette(context.colors, status);
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppDimensions.gapSm,
        vertical: 2,
      ),
      decoration: BoxDecoration(
        color: background,
        borderRadius: AppDimensions.borderRadiusPill,
      ),
      child: Text(
        _label(status),
        style: context.textStyles.textVerySmallBold.copyWith(color: foreground),
      ),
    );
  }
}
