import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_modular/flutter_modular.dart';

import '../../../core/auth/auth_user.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/colors_app.dart';
import '../../../shared/components/buttons/app_primary_button.dart';
import '../../../shared/components/feedback/app_error_banner.dart';
import '../../../shared/components/forms/app_text_field.dart';
import '../../../shared/utils/validators.dart';
import 'login_controller.dart';
import 'widgets/auth_scaffold.dart';

/// Tela de login (e-mail/senha) com estados de loading/erro. Ao autenticar,
/// direciona para a troca de senha obrigatória (1º acesso) ou para o shell.
class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  late final LoginController _controller;
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _passwordFocus = FocusNode();

  @override
  void initState() {
    super.initState();
    _controller = inject<LoginController>();
    unawaited(_bootstrap());
  }

  /// Preenche o e-mail lembrado e move o foco para a senha. Sem spinner:
  /// o form abre no default e é preenchido quando as prefs chegarem; se o
  /// usuário já digitou no campo, o valor lido NÃO sobrescreve.
  Future<void> _bootstrap() async {
    await _controller.bootstrap();
    if (!mounted) return;
    final email = _controller.initialEmail;
    if (email == null || email.isEmpty) return;
    if (_emailController.text.isNotEmpty) return;
    _emailController.text = email;
    _passwordFocus.requestFocus();
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final user = await _controller.submit(
      _emailController.text,
      _passwordController.text,
    );
    if (user == null || !mounted) return;
    _routeAfterLogin(user);
  }

  void _routeAfterLogin(AuthUser user) {
    if (user.mustChangePassword) {
      context.navigate('/auth/change-password');
      return;
    }
    context.navigate('/home/dashboard');
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: 'Entrar',
      subtitle: 'Acesse o assistente de conhecimento com suas credenciais.',
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
                  label: 'E-mail',
                  controller: _emailController,
                  hint: 'voce@empresa.com',
                  autofocus: true,
                  enabled: !_controller.loading,
                  keyboardType: TextInputType.emailAddress,
                  prefixIcon: Icons.mail_outline,
                  validator: Validators.email,
                ),
                AppDimensions.vGapLg,
                AppTextField(
                  label: 'Senha',
                  controller: _passwordController,
                  focusNode: _passwordFocus,
                  obscure: true,
                  enabled: !_controller.loading,
                  prefixIcon: Icons.lock_outline,
                  validator: (v) => Validators.required(v, field: 'Senha'),
                  onSubmitted: (_) => _submit(),
                ),
                AppDimensions.vGapSm,
                _RememberEmailCheckbox(
                  value: _controller.rememberEmail,
                  enabled: !_controller.loading,
                  onChanged: _controller.setRememberEmail,
                ),
                AppDimensions.vGapMd,
                AppPrimaryButton(
                  label: 'Entrar',
                  expand: true,
                  loading: _controller.loading,
                  onPressed: _submit,
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// Checkbox "Lembrar meu e-mail": compacto, alinhado aos campos do form,
/// default marcado. Desmarcar apaga o e-mail salvo na hora (controller).
class _RememberEmailCheckbox extends StatelessWidget {
  const _RememberEmailCheckbox({
    required this.value,
    required this.enabled,
    required this.onChanged,
  });

  final bool value;
  final bool enabled;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    // Material próprio (transparente): o card do AuthScaffold é um DecoratedBox
    // e o ListTile pinta o ink no Material ancestral — sem este wrapper o
    // framework acusa "ink splashes may be invisible".
    return Material(
      type: MaterialType.transparency,
      child: CheckboxListTile(
        key: const Key('login-remember-email'),
        value: value,
        onChanged: enabled ? (v) => onChanged(v ?? true) : null,
        controlAffinity: ListTileControlAffinity.leading,
        contentPadding: EdgeInsets.zero,
        visualDensity: VisualDensity.compact,
        dense: true,
        activeColor: context.colors.primary,
        title: Text('Lembrar meu e-mail', style: context.textStyles.textSmall),
      ),
    );
  }
}
