import 'package:flutter/material.dart';
import 'package:flutter_modular/flutter_modular.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../shared/components/buttons/app_primary_button.dart';
import '../../../shared/components/buttons/app_secondary_button.dart';
import '../../../shared/components/feedback/app_error_banner.dart';
import '../../../shared/components/forms/app_text_field.dart';
import '../../../shared/utils/validators.dart';
import '../services/session_service.dart';
import 'change_password_controller.dart';
import 'widgets/auth_scaffold.dart';

/// Troca de senha obrigatória no 1º acesso. Bloqueia o acesso ao shell até a
/// conclusão; o único escape é o logout (volta ao login).
class ChangePasswordPage extends StatefulWidget {
  const ChangePasswordPage({super.key});

  @override
  State<ChangePasswordPage> createState() => _ChangePasswordPageState();
}

class _ChangePasswordPageState extends State<ChangePasswordPage> {
  late final ChangePasswordController _controller;
  final _formKey = GlobalKey<FormState>();
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _controller = inject<ChangePasswordController>();
  }

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final user = await _controller.submit(
      _currentController.text,
      _newController.text,
      _confirmController.text,
    );
    if (user == null || !mounted) return;
    context.navigate('/home/dashboard');
  }

  Future<void> _logout() async {
    await inject<SessionService>().logout();
    if (!mounted) return;
    context.navigate('/auth/login');
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: 'Defina uma nova senha',
      subtitle:
          'Por segurança, é necessário trocar a senha temporária antes de '
          'continuar.',
      child: Form(
        key: _formKey,
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                AppErrorBanner(message: _controller.error),
                if (_controller.error != null) AppDimensions.vGapLg,
                AppTextField(
                  label: 'Senha atual',
                  controller: _currentController,
                  obscure: true,
                  autofocus: true,
                  enabled: !_controller.loading,
                  prefixIcon: Icons.lock_outline,
                  validator: (v) =>
                      Validators.required(v, field: 'Senha atual'),
                ),
                AppDimensions.vGapLg,
                AppTextField(
                  label: 'Nova senha',
                  controller: _newController,
                  obscure: true,
                  enabled: !_controller.loading,
                  prefixIcon: Icons.lock_reset_outlined,
                  validator: Validators.password,
                ),
                AppDimensions.vGapLg,
                AppTextField(
                  label: 'Confirmar nova senha',
                  controller: _confirmController,
                  obscure: true,
                  enabled: !_controller.loading,
                  prefixIcon: Icons.lock_reset_outlined,
                  validator: (v) => Validators.confirm(v, _newController.text),
                  onSubmitted: (_) => _submit(),
                ),
                AppDimensions.vGapXl,
                AppPrimaryButton(
                  label: 'Salvar e continuar',
                  expand: true,
                  loading: _controller.loading,
                  onPressed: _submit,
                ),
                AppDimensions.vGapSm,
                AppSecondaryButton(
                  label: 'Sair',
                  onPressed: _controller.loading ? null : _logout,
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
