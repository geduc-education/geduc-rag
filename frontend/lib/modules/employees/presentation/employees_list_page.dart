import 'package:flutter/material.dart';
import 'package:flutter_modular/flutter_modular.dart';

import '../../../core/auth/app_permissions.dart';
import '../../../core/auth/permission_service.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../shared/components/buttons/app_primary_button.dart';
import '../../../shared/components/feedback/app_confirm_dialog.dart';
import '../../../shared/components/feedback/app_state_views.dart';
import '../../../shared/components/feedback/app_toast.dart';
import '../../../shared/components/forms/app_dropdown_field.dart';
import '../../../shared/components/forms/app_text_field.dart';
import '../../../shared/components/navigation/app_pager.dart';
import '../data/models/employee_model.dart';
import 'employees_list_controller.dart';
import 'widgets/employee_tile.dart';
import 'widgets/purge_employee_dialog.dart';

/// Listagem de funcionários do tenant ativo com busca, filtro de status,
/// paginação e ações por item (editar, excluir e excluir definitivamente).
class EmployeesListPage extends StatefulWidget {
  const EmployeesListPage({super.key});

  @override
  State<EmployeesListPage> createState() => _EmployeesListPageState();
}

class _EmployeesListPageState extends State<EmployeesListPage> {
  late final EmployeesListController _controller;
  late final PermissionService _permissions;
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _controller = inject<EmployeesListController>();
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
  bool get _canPurge => _permissions.can(AppPermissions.employeePurge);

  Future<void> _openForm([EmployeeModel? employee]) async {
    final changed = await context.pushNamed<bool>(
      './form',
      arguments: employee,
    );
    if (changed == true) _controller.load();
  }

  void _toast(String? error, String success) {
    if (!mounted) return;
    showAppToast(
      context,
      error ?? success,
      type: error == null ? AppToastType.success : AppToastType.error,
    );
  }

  Future<void> _remove(EmployeeModel employee) async {
    final confirmed = await AppConfirmDialog.show(
      context,
      title: 'Excluir funcionário',
      message:
          'O funcionário "${employee.name}" será excluído e deixará de '
          'aparecer na listagem. O e-mail e o CPF continuam reservados.',
      confirmLabel: 'Excluir',
      danger: true,
    );
    if (!confirmed) return;
    final error = await _controller.remove(employee);
    _toast(error, 'Funcionário excluído.');
  }

  Future<void> _purge(EmployeeModel employee) async {
    final confirmed = await PurgeEmployeeDialog.show(context, employee.name);
    if (!confirmed) return;
    final error = await _controller.purge(employee);
    _toast(error, 'Funcionário excluído definitivamente.');
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
            _Toolbar(
              searchController: _searchController,
              filter: _controller.filter,
              onSearch: _controller.search,
              onFilter: _controller.setFilter,
              onRefresh: _controller.load,
              onCreate: _canManage ? _openForm : null,
            ),
            AppDimensions.vGapLg,
            Expanded(child: _buildBody()),
            if (_controller.state == EmployeesViewState.ready) ...<Widget>[
              AppDimensions.vGapMd,
              AppPager(
                label:
                    'Página ${_controller.page} de ${_controller.pageCount} · '
                    '${_controller.total} funcionário(s)',
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
      case EmployeesViewState.loading:
        return const AppLoadingView();
      case EmployeesViewState.error:
        return AppErrorView(
          message: _controller.error ?? 'Erro ao carregar.',
          onRetry: _controller.load,
        );
      case EmployeesViewState.empty:
        return const AppEmptyView(
          message: 'Nenhum funcionário encontrado.',
          icon: Icons.badge_outlined,
        );
      case EmployeesViewState.ready:
        return ListView.separated(
          itemCount: _controller.employees.length,
          separatorBuilder: (_, _) => AppDimensions.vGapSm,
          itemBuilder: (_, i) {
            final employee = _controller.employees[i];
            return EmployeeTile(
              employee: employee,
              canManage: _canManage,
              canPurge: _canPurge,
              onEdit: () => _openForm(employee),
              onRemove: () => _remove(employee),
              onPurge: () => _purge(employee),
            );
          },
        );
    }
  }
}

/// Busca, filtro de status, atualizar e "Adicionar" (só com
/// `employee:manage`).
class _Toolbar extends StatelessWidget {
  const _Toolbar({
    required this.searchController,
    required this.filter,
    required this.onSearch,
    required this.onFilter,
    required this.onRefresh,
    required this.onCreate,
  });

  final TextEditingController searchController;
  final EmployeeActiveFilter filter;
  final ValueChanged<String> onSearch;
  final ValueChanged<EmployeeActiveFilter> onFilter;
  final VoidCallback onRefresh;
  final VoidCallback? onCreate;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: <Widget>[
        Expanded(
          child: AppTextField(
            label: 'Buscar',
            hint: 'Nome, e-mail ou CPF',
            controller: searchController,
            prefixIcon: Icons.search,
            onSubmitted: onSearch,
          ),
        ),
        AppDimensions.hGapLg,
        SizedBox(
          width: 180,
          child: AppDropdownField<EmployeeActiveFilter>(
            label: 'Status',
            value: filter,
            options: <AppDropdownOption<EmployeeActiveFilter>>[
              for (final option in EmployeeActiveFilter.values)
                AppDropdownOption(value: option, label: option.label),
            ],
            onChanged: (value) {
              if (value != null) onFilter(value);
            },
          ),
        ),
        AppDimensions.hGapSm,
        IconButton(
          tooltip: 'Atualizar lista',
          icon: const Icon(Icons.refresh),
          onPressed: onRefresh,
        ),
        if (onCreate != null) ...<Widget>[
          AppDimensions.hGapLg,
          AppPrimaryButton(
            label: 'Adicionar',
            icon: Icons.person_add_alt_1,
            onPressed: onCreate,
          ),
        ],
      ],
    );
  }
}
