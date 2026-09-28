import 'package:flutter/material.dart';
import 'package:flutter_modular/flutter_modular.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../shared/components/feedback/app_inline_notice.dart';
import '../../../shared/components/feedback/app_state_views.dart';
import 'changelog_controller.dart';
import 'widgets/changelog_group_section.dart';

/// Página de Novidades: atualizações do produto (PRs mergeados no GitHub)
/// agrupadas por tipo. O controller é singleton do shell e busca uma vez por
/// sessão.
class ChangelogPage extends StatefulWidget {
  const ChangelogPage({super.key});

  @override
  State<ChangelogPage> createState() => _ChangelogPageState();
}

class _ChangelogPageState extends State<ChangelogPage> {
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
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) =>
          Padding(padding: AppDimensions.paddingXl, child: _buildBody()),
    );
  }

  Widget _buildBody() {
    switch (_controller.state) {
      case ChangelogViewState.loading:
        return const AppLoadingView();
      case ChangelogViewState.notConfigured:
        return const AppEmptyView(
          message:
              'As novidades ainda não foram configuradas. Defina GITHUB_REPO '
              'no backend para listar as atualizações do produto.',
          icon: Icons.campaign_outlined,
        );
      case ChangelogViewState.empty:
        return const AppEmptyView(
          message: 'Nenhuma novidade publicada ainda.',
          icon: Icons.campaign_outlined,
        );
      case ChangelogViewState.error:
        return AppErrorView(
          message:
              _controller.error ?? 'Não foi possível carregar as novidades.',
          onRetry: _controller.load,
        );
      case ChangelogViewState.ready:
        return _ChangelogList(
          groups: _controller.groups,
          stale: _controller.stale,
        );
    }
  }
}

class _ChangelogList extends StatelessWidget {
  const _ChangelogList({required this.groups, required this.stale});

  final List<ChangelogGroup> groups;
  final bool stale;

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: <Widget>[
        if (stale) ...<Widget>[
          const AppInlineNotice(
            tone: AppNoticeTone.warning,
            icon: Icons.cloud_off_outlined,
            message:
                'Exibindo a última lista obtida: o GitHub está indisponível '
                'no momento.',
          ),
          AppDimensions.vGapLg,
        ],
        for (final group in groups) ...<Widget>[
          ChangelogGroupSection(group: group),
          AppDimensions.vGapLg,
        ],
      ],
    );
  }
}
