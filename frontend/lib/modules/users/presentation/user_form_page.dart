import 'package:flutter/material.dart';
import 'package:flutter_modular/flutter_modular.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/colors_app.dart';
import '../../../shared/components/buttons/app_primary_button.dart';
import '../../../shared/components/buttons/app_secondary_button.dart';
import '../../../shared/components/feedback/app_error_banner.dart';
import '../../../shared/components/feedback/app_state_views.dart';
import '../../../shared/components/forms/app_multi_select_chips.dart';
import '../../../shared/components/forms/app_text_field.dart';
import '../../../shared/utils/validators.dart';
import '../data/models/user_model.dart';
import '../data/users_repository.dart';
import 'user_form_controller.dart';

/// Formulário de criar/editar usuário: dados básicos, senha temporária (só na
/// criação) e multiselect de perfis e tenants.
class UserFormPage extends StatefulWidget {
  const UserFormPage({super.key, this.user});

  final UserModel? user;

  @override
  State<UserFormPage> createState() => _UserFormPageState();
}

class _UserFormPageState extends State<UserFormPage> {
  late final UserFormController _controller;
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _email;
  final _password = TextEditingController();

  @override
  void initState() {
    super.initState();
    _controller = UserFormController(
      inject<IUsersRepository>(),
      editing: widget.user,
    );
    _name = TextEditingController(text: widget.user?.name ?? '');
    _email = TextEditingController(text: widget.user?.email ?? '');
    _controller.bootstrap();
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    _controller.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final ok = await _controller.save(
      name: _name.text,
      email: _email.text,
      password: _controller.isEditing ? null : _password.text,
    );
    // Volta para a lista (que recarrega ao montar). `pop` dispara "Future
    // already completed" no RouterOutlet do shell.
    if (ok && mounted) context.navigate('/home/users/');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_controller.isEditing ? 'Editar usuário' : 'Novo usuário'),
      ),
      body: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          if (_controller.loading) return const AppLoadingView();
          return SingleChildScrollView(
            padding: AppDimensions.paddingXl,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 560),
                child: Form(key: _formKey, child: _buildFields()),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildFields() {
    final saving = _controller.saving;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        AppErrorBanner(message: _controller.error),
        if (_controller.error != null) AppDimensions.vGapLg,
        AppTextField(
          label: 'Nome',
          controller: _name,
          enabled: !saving,
          validator: (v) => Validators.required(v, field: 'Nome'),
        ),
        AppDimensions.vGapLg,
        AppTextField(
          label: 'E-mail',
          controller: _email,
          enabled: !saving,
          keyboardType: TextInputType.emailAddress,
          validator: Validators.email,
        ),
        if (!_controller.isEditing) ...<Widget>[
          AppDimensions.vGapLg,
          AppTextField(
            label: 'Senha temporária',
            controller: _password,
            obscure: true,
            enabled: !saving,
            prefixIcon: Icons.lock_outline,
            validator: Validators.password,
          ),
          AppDimensions.vGapXs,
          const _Hint('O usuário deverá trocar a senha no primeiro acesso.'),
        ],
        AppDimensions.vGapXl,
        _Section(
          title: 'Perfis',
          child: AppMultiSelectChips(
            label: 'Atribua um ou mais perfis',
            options: <MultiSelectOption>[
              for (final p in _controller.profiles)
                MultiSelectOption(id: p.id, label: p.name),
            ],
            selectedIds: _controller.selectedProfileIds,
            onToggle: _controller.toggleProfile,
          ),
        ),
        AppDimensions.vGapXl,
        _Section(
          title: 'Tenants',
          child: AppMultiSelectChips(
            label: 'Vincule um ou mais tenants',
            options: <MultiSelectOption>[
              for (final t in _controller.tenants)
                MultiSelectOption(id: t.id, label: t.name),
            ],
            selectedIds: _controller.selectedTenantIds,
            onToggle: _controller.toggleTenant,
            emptyHint: 'Nenhum tenant disponível.',
          ),
        ),
        if (_controller.outOfScopeTenantCount > 0) ...<Widget>[
          AppDimensions.vGapSm,
          _Hint(
            '${_controller.outOfScopeTenantCount} vínculo(s) fora do seu '
            'acesso serão mantidos.',
          ),
        ],
        AppDimensions.vGapXxl,
        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: <Widget>[
            AppSecondaryButton(
              label: 'Cancelar',
              onPressed: saving ? null : () => context.navigate('/home/users/'),
            ),
            AppDimensions.hGapSm,
            AppPrimaryButton(
              label: 'Salvar',
              loading: saving,
              onPressed: _save,
            ),
          ],
        ),
      ],
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: <Widget>[
      Text(title, style: context.textStyles.textTile16),
      AppDimensions.vGapSm,
      child,
    ],
  );
}

class _Hint extends StatelessWidget {
  const _Hint(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Text(
    text,
    style: context.textStyles.textSmall.copyWith(
      color: context.colors.textMuted,
    ),
  );
}
