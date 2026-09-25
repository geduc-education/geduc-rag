import 'package:flutter/material.dart';
import 'package:flutter_modular/flutter_modular.dart';

import '../../../core/auth/app_permissions.dart';
import '../../../core/auth/permission_service.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../shared/components/buttons/app_primary_button.dart';
import '../../../shared/components/feedback/app_confirm_dialog.dart';
import '../../../shared/components/feedback/app_state_views.dart';
import '../../../shared/components/feedback/app_toast.dart';
import '../../../shared/components/forms/app_text_field.dart';
import '../../../shared/components/navigation/app_pager.dart';
import '../data/models/user_model.dart';
import 'users_list_controller.dart';
import 'widgets/reset_password_dialog.dart';
import 'widgets/user_tile.dart';

/// Listagem de usuários com busca, paginação e ações por item. A lista já
/// chega filtrada pelo backend ao alcance do ator (tenants em comum).
class UsersListPage extends StatefulWidget {
  const UsersListPage({super.key});

  @override
  State<UsersListPage> createState() => _UsersListPageState();
}

class _UsersListPageState extends State<UsersListPage> {
  late final UsersListController _controller;
  late final PermissionService _permissions;
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _controller = inject<UsersListController>();
    _permissions = inject<PermissionService>();
    // Pós-frame: o controller é singleton no escopo do shell; notificar
    // durante o build colidiria com a lista em transição ("setState() during
    // build").
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _controller.bootstrap();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  bool get _canManage => _permissions.can(AppPermissions.userManage);

  bool _isSelf(UserModel user) => _permissions.user?.id == user.id;

  Future<void> _openForm([UserModel? user]) async {
    final changed = await context.pushNamed<bool>('./form', arguments: user);
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

  Future<void> _resetPassword(UserModel user) async {
    final password = await ResetPasswordDialog.show(context, user.email);
    if (password == null) return;
    final error = await _controller.resetPassword(user, password);
    _toast(error, 'Senha redefinida. O usuário trocará no próximo acesso.');
  }

  Future<void> _toggle(UserModel user) async {
    final confirmed = await AppConfirmDialog.show(
      context,
      title: user.active ? 'Inativar usuário' : 'Reativar usuário',
      message: user.active
          ? 'O usuário "${user.name}" perderá o acesso à plataforma.'
          : 'O usuário "${user.name}" voltará a ter acesso.',
      confirmLabel: user.active ? 'Inativar' : 'Reativar',
      danger: user.active,
    );
    if (!confirmed) return;
    final error = await _controller.toggleActive(user);
    _toast(error, user.active ? 'Usuário inativado.' : 'Usuário reativado.');
  }

  Future<void> _remove(UserModel user) async {
    final confirmed = await AppConfirmDialog.show(
      context,
      title: 'Excluir usuário',
      message:
          'O usuário "${user.name}" será excluído e perderá o acesso. '
          'O e-mail continua reservado.',
      confirmLabel: 'Excluir',
      danger: true,
    );
    if (!confirmed) return;
    final error = await _controller.remove(user);
    _toast(error, 'Usuário excluído.');
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
              onSearch: _controller.search,
              onCreate: _canManage ? _openForm : null,
            ),
            AppDimensions.vGapLg,
            Expanded(child: _buildBody()),
            if (_controller.state == ViewState.ready) ...<Widget>[
              AppDimensions.vGapMd,
              AppPager(
                label:
                    'Página ${_controller.page} de ${_controller.pageCount} · '
                    '${_controller.total} usuário(s)',
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
      case ViewState.loading:
        return const AppLoadingView();
      case ViewState.error:
        return AppErrorView(
          message: _controller.error ?? 'Erro ao carregar.',
          onRetry: _controller.load,
        );
      case ViewState.empty:
        return const AppEmptyView(message: 'Nenhum usuário encontrado.');
      case ViewState.ready:
        return ListView.separated(
          itemCount: _controller.users.length,
          separatorBuilder: (_, _) => AppDimensions.vGapSm,
          itemBuilder: (_, i) {
            final user = _controller.users[i];
            return UserTile(
              user: user,
              canManage: _canManage,
              isSelf: _isSelf(user),
              onEdit: () => _openForm(user),
              onResetPassword: () => _resetPassword(user),
              onToggle: () => _toggle(user),
              onRemove: () => _remove(user),
            );
          },
        );
    }
  }
}

/// Busca + botão "Novo usuário" (só com `user:manage`).
class _Toolbar extends StatelessWidget {
  const _Toolbar({
    required this.searchController,
    required this.onSearch,
    required this.onCreate,
  });

  final TextEditingController searchController;
  final ValueChanged<String> onSearch;
  final VoidCallback? onCreate;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Expanded(
          child: AppTextField(
            label: 'Buscar',
            hint: 'Nome ou e-mail',
            controller: searchController,
            prefixIcon: Icons.search,
            onSubmitted: onSearch,
          ),
        ),
        if (onCreate != null) ...<Widget>[
          AppDimensions.hGapLg,
          AppPrimaryButton(
            label: 'Novo usuário',
            icon: Icons.person_add_alt_1,
            onPressed: onCreate,
          ),
        ],
      ],
    );
  }
}
