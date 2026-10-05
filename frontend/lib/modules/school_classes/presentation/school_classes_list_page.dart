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
import '../data/models/school_class_model.dart';
import 'school_classes_list_controller.dart';
import 'widgets/school_select_field.dart';

/// Largura do filtro de escola na barra da listagem.
const double _schoolFilterWidth = 240;

/// Listagem de turmas do tenant ativo com busca, filtros de escola e status,
/// paginação e ações por item (editar e excluir).
class SchoolClassesListPage extends StatefulWidget {
  const SchoolClassesListPage({super.key});

  @override
  State<SchoolClassesListPage> createState() => _SchoolClassesListPageState();
}

class _SchoolClassesListPageState extends State<SchoolClassesListPage> {
  late final SchoolClassesListController _controller;
  late final PermissionService _permissions;
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _controller = inject<SchoolClassesListController>();
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

  Future<void> _openForm([SchoolClassModel? schoolClass]) async {
    final changed = await context.pushNamed<bool>(
      './form',
      arguments: schoolClass,
    );
    if (changed == true) _controller.load();
  }

  Future<void> _remove(SchoolClassModel schoolClass) async {
    final confirmed = await AppConfirmDialog.show(
      context,
      title: 'Excluir turma',
      message:
          'A turma "${schoolClass.name}" (${schoolClass.description}) será '
          'excluída e deixará de aparecer na listagem.',
      confirmLabel: 'Excluir',
      danger: true,
    );
    if (!confirmed) return;
    final error = await _controller.remove(schoolClass);
    if (!mounted) return;
    showAppToast(
      context,
      error ?? 'Turma excluída.',
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
            _buildToolbar(),
            AppDimensions.vGapLg,
            Expanded(child: _buildBody()),
            if (_controller.state == ListViewState.ready) ...<Widget>[
              AppDimensions.vGapMd,
              AppPager(
                label:
                    'Página ${_controller.page} de ${_controller.pageCount} · '
                    '${_controller.total} turma(s)',
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

  Widget _buildToolbar() {
    return AppListToolbar(
      searchController: _searchController,
      searchHint: 'Nome da turma',
      status: _controller.filter,
      onSearch: _controller.search,
      onStatus: _controller.setFilter,
      onRefresh: _controller.load,
      onCreate: _canManage ? _openForm : null,
      createIcon: Icons.group_add_outlined,
      filters: <Widget>[
        SizedBox(
          width: _schoolFilterWidth,
          child: SchoolSelectField(
            label: 'Escola',
            allLabel: 'Todas as escolas',
            schools: _controller.schools,
            value: _controller.schoolId,
            onChanged: _controller.setSchool,
          ),
        ),
      ],
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
          message: 'Nenhuma turma encontrada.',
          icon: Icons.groups_outlined,
        );
      case ListViewState.ready:
        return ListView.separated(
          itemCount: _controller.classes.length,
          separatorBuilder: (_, _) => AppDimensions.vGapSm,
          itemBuilder: (_, i) {
            final schoolClass = _controller.classes[i];
            return AppRecordTile(
              title: schoolClass.name,
              subtitle: schoolClass.description,
              icon: Icons.groups_outlined,
              active: schoolClass.active,
              onEdit: _canManage ? () => _openForm(schoolClass) : null,
              onRemove: _canManage ? () => _remove(schoolClass) : null,
            );
          },
        );
    }
  }
}
