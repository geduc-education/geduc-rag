import 'package:flutter/material.dart';
import 'package:flutter_modular/flutter_modular.dart';

import '../../../core/auth/app_permissions.dart';
import '../../../core/auth/permission_service.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../shared/components/feedback/app_confirm_dialog.dart';
import '../../../shared/components/feedback/app_state_views.dart';
import '../../../shared/components/feedback/app_toast.dart';
import '../../../shared/components/layout/app_list_toolbar.dart';
import '../../../shared/components/layout/app_record_tile.dart';
import '../../../shared/components/navigation/app_pager.dart';
import '../../../shared/utils/list_filters.dart';
import '../data/models/school_model.dart';
import 'schools_list_controller.dart';

/// Listagem de escolas do tenant ativo com busca, filtro de status,
/// paginação e ações por item (editar e excluir).
class SchoolsListPage extends StatefulWidget {
  const SchoolsListPage({super.key});

  @override
  State<SchoolsListPage> createState() => _SchoolsListPageState();
}

class _SchoolsListPageState extends State<SchoolsListPage> {
  late final SchoolsListController _controller;
  late final PermissionService _permissions;
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _controller = inject<SchoolsListController>();
    _permissions = inject<PermissionService>();
    // Pós-frame: o controller é singleton do shell (ver `UsersListPage`).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _controller.bootstrap();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  bool get _canManage => _permissions.can(AppPermissions.employeeManage);

  Future<void> _openForm([SchoolModel? school]) async {
    final changed = await context.pushNamed<bool>('./form', arguments: school);
    if (changed == true) _controller.load();
  }

  Future<void> _remove(SchoolModel school) async {
    final confirmed = await AppConfirmDialog.show(
      context,
      title: 'Excluir escola',
      message:
          'A escola "${school.name}" será excluída e deixará de aparecer na '
          'listagem. O nome continua reservado.',
      confirmLabel: 'Excluir',
      danger: true,
    );
    if (!confirmed) return;
    final error = await _controller.remove(school);
    if (!mounted) return;
    showAppToast(
      context,
      error ?? 'Escola excluída.',
      type: error == null ? AppToastType.success : AppToastType.error,
    );
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
            AppListToolbar(
              searchController: _searchController,
              searchHint: 'Nome da escola',
              status: _controller.filter,
              onSearch: _controller.search,
              onStatus: _controller.setFilter,
              onRefresh: _controller.load,
              onCreate: _canManage ? _openForm : null,
              createIcon: Icons.add_business_outlined,
            ),
            AppDimensions.vGapLg,
            Expanded(child: _buildBody()),
            if (_controller.state == ListViewState.ready) ...<Widget>[
              AppDimensions.vGapMd,
              AppPager(
                label:
                    'Página ${_controller.page} de ${_controller.pageCount} · '
                    '${_controller.total} escola(s)',
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

  Widget _buildBody() {
    switch (_controller.state) {
      case ListViewState.loading:
        return const AppLoadingView();
      case ListViewState.error:
        return AppErrorView(
          message: _controller.error ?? 'Erro ao carregar.',
          onRetry: _controller.load,
        );
      case ListViewState.empty:
        return const AppEmptyView(
          message: 'Nenhuma escola encontrada.',
          icon: Icons.school_outlined,
        );
      case ListViewState.ready:
        return ListView.separated(
          itemCount: _controller.schools.length,
          separatorBuilder: (_, _) => AppDimensions.vGapSm,
          itemBuilder: (_, i) {
            final school = _controller.schools[i];
            return AppRecordTile(
              title: school.name,
              icon: Icons.school_outlined,
              active: school.active,
              onEdit: _canManage ? () => _openForm(school) : null,
              onRemove: _canManage ? () => _remove(school) : null,
            );
          },
        );
    }
  }
}
