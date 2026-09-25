import 'package:flutter/material.dart';

import '../../../../../core/theme/app_dimensions.dart';
import '../../../../../core/theme/app_text_styles.dart';
import '../../../../../core/theme/colors_app.dart';
import '../../../data/models/chat_answer.dart';

/// Citação de uma resposta: nome do documento e, ao expandir, o trecho usado.
class CitationCard extends StatefulWidget {
  const CitationCard({super.key, required this.citation});

  final ChatCitation citation;

  @override
  State<CitationCard> createState() => _CitationCardState();
}

class _CitationCardState extends State<CitationCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final styles = context.textStyles;
    final filename = widget.citation.filename.isEmpty
        ? 'Documento'
        : widget.citation.filename;
    return Container(
      decoration: BoxDecoration(
        color: colors.surfaceMuted,
        borderRadius: AppDimensions.borderRadiusSm,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          InkWell(
            borderRadius: AppDimensions.borderRadiusSm,
            onTap: () => setState(() => _expanded = !_expanded),
            child: Padding(
              padding: AppDimensions.paddingSm,
              child: Row(
                children: <Widget>[
                  Icon(
                    Icons.description_outlined,
                    size: AppDimensions.iconSizeXs,
                    color: colors.textSecondary,
                  ),
                  AppDimensions.hGapSm,
                  Expanded(
                    child: Text(
                      filename,
                      overflow: TextOverflow.ellipsis,
                      style: styles.textSmallBold.copyWith(
                        color: colors.textPrimary,
                      ),
                    ),
                  ),
                  Icon(
                    _expanded ? Icons.expand_less : Icons.expand_more,
                    size: AppDimensions.iconSizeMd,
                    color: colors.textMuted,
                  ),
                ],
              ),
            ),
          ),
          if (_expanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppDimensions.gapSm,
                0,
                AppDimensions.gapSm,
                AppDimensions.gapSm,
              ),
              child: SelectableText(
                widget.citation.excerpt,
                style: styles.textSmall.copyWith(color: colors.textSecondary),
              ),
            ),
        ],
      ),
    );
  }
}
