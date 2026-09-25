import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../shared/components/buttons/app_primary_button.dart';
import '../../../../shared/components/buttons/app_secondary_button.dart';
import '../../../../shared/components/forms/app_text_field.dart';
import '../../../../shared/utils/validators.dart';

/// Diálogo de redefinição de senha pelo administrador: coleta a nova senha
/// TEMPORÁRIA (o usuário troca no próximo acesso). Devolve a senha ou `null`.
class ResetPasswordDialog extends StatefulWidget {
  const ResetPasswordDialog({super.key, required this.userEmail});

  final String userEmail;

  static Future<String?> show(BuildContext context, String userEmail) =>
      showDialog<String>(
        context: context,
        builder: (_) => ResetPasswordDialog(userEmail: userEmail),
      );

  @override
  State<ResetPasswordDialog> createState() => _ResetPasswordDialogState();
}

class _ResetPasswordDialogState extends State<ResetPasswordDialog> {
  final _formKey = GlobalKey<FormState>();
  final _password = TextEditingController();

  @override
  void dispose() {
    _password.dispose();
    super.dispose();
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    Navigator.of(context).pop(_password.text);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Redefinir senha'),
      content: SizedBox(
        width: 400,
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(
                'Defina uma senha temporária para ${widget.userEmail}. '
                'O usuário deverá trocá-la no próximo acesso.',
              ),
              AppDimensions.vGapLg,
              AppTextField(
                label: 'Senha temporária',
                controller: _password,
                obscure: true,
                autofocus: true,
                prefixIcon: Icons.lock_reset_outlined,
                validator: Validators.password,
                onSubmitted: (_) => _submit(),
              ),
            ],
          ),
        ),
      ),
      actions: <Widget>[
        AppSecondaryButton(
          label: 'Cancelar',
          onPressed: () => Navigator.of(context).pop(),
        ),
        AppPrimaryButton(label: 'Redefinir', onPressed: _submit),
      ],
    );
  }
}
