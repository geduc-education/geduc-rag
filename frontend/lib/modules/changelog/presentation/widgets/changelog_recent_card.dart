import 'package:flutter/material.dart';
import 'package:flutter_modular/flutter_modular.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/colors_app.dart';
import '../../../../shared/components/layout/app_section_card.dart';
import '../../../../shared/utils/app_date_formats.dart';
import '../../data/models/changelog_entry.dart';
import '../changelog_controller.dart';
import 'changelog_type_badge.dart';

/// Card "Novidades recentes" da tela de início: os [count] itens mais novos do
/// feed, com estados compactos. Usa o mesmo `ChangelogController` singleton da
/// página de Novidades, então as duas telas fazem uma única busca por sessão.
class ChangelogRecentCard extends StatefulWidget {
  const ChangelogRecentCard({super.key, this.count = 5});

  final int count;

  @override
  State<ChangelogRecentCard> createState() => _ChangelogRecentCardState();
}

class _ChangelogRecentCardState extends State<ChangelogRecentCard> {
  late final ChangelogController _controller;

  @override
  void initState() {
    super.initState();
    _controller = inject<ChangelogController>();
    // Pós-frame: notificar durante o build dispararia "setState() during build".
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _controller.ensureLoaded();
    });
  }

  @override
  Widget build(BuildContext context) {
    return AppSectionCard(
      title: 'Novidades recentes',
      action: TextButton(
        onPressed: () => context.navigate('/home/changelog'),
        child: const Text('Ver todas'),
      ),
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) => _buildBody(context),
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    switch (_controller.state) {
      case ChangelogViewState.loading:
        return const LinearProgressIndicator();
      case ChangelogViewState.notConfigured:
        return const _CardMessage('Novidades ainda não configuradas.');
      case ChangelogViewState.empty:
        return const _CardMessage('Nenhuma novidade publicada ainda.');
      case ChangelogViewState.error:
        return _CardError(
          message: _controller.error ?? '',
          onRetry: _controller.load,
        );
      case ChangelogViewState.ready:
        return _RecentList(entries: _controller.recent(widget.count));
    }
  }
}

class _CardMessage extends StatelessWidget {
  const _CardMessage(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    return Text(
      message,
      style: context.textStyles.textRegular.copyWith(
        color: context.colors.textMuted,
      ),
    );
  }
}

class _CardError extends StatelessWidget {
  const _CardError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Expanded(
          child: Text(
            message,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: context.textStyles.textRegular.copyWith(
              color: context.colors.danger700,
            ),
          ),
        ),
        AppDimensions.hGapSm,
        TextButton(onPressed: onRetry, child: const Text('Tentar novamente')),
      ],
    );
  }
}

class _RecentList extends StatelessWidget {
  const _RecentList({required this.entries});

  final List<ChangelogEntry> entries;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        for (var i = 0; i < entries.length; i++) ...<Widget>[
          if (i > 0) AppDimensions.vGapSm,
          _RecentRow(entry: entries[i]),
        ],
      ],
    );
  }
}

class _RecentRow extends StatelessWidget {
  const _RecentRow({required this.entry});

  final ChangelogEntry entry;

  @override
  Widget build(BuildContext context) {
    final styles = context.textStyles;
    return Row(
      children: <Widget>[
        ChangelogTypeBadge(type: entry.type, compact: true),
        AppDimensions.hGapMd,
        Expanded(
          child: Text(
            entry.title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: styles.textRegular,
          ),
        ),
        AppDimensions.hGapMd,
        Text(
          formatShortDate(entry.mergedAt.toLocal()),
          style: styles.textSmall.copyWith(color: context.colors.textMuted),
        ),
      ],
    );
  }
}
