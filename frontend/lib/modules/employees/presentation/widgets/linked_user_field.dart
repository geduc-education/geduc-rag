import 'package:flutter/material.dart';

import '../../../../shared/components/forms/app_dropdown_field.dart';
import '../employee_form_controller.dart';

/// Seletor do usuário da plataforma vinculado ao funcionário. A opção
/// "Nenhum" limpa o vínculo (na edição vira `userId: null` no PATCH).
class LinkedUserField extends StatelessWidget {
  const LinkedUserField({
    super.key,
    required this.controller,
    this.enabled = true,
  });

  final EmployeeFormController controller;
  final bool enabled;

  /// Valor sentinela da opção "Nenhum" (o dropdown não exibe `null`).
  static const String _none = '';

  @override
  Widget build(BuildContext context) {
    final loading = controller.loadingUsers;
    return AppDropdownField<String>(
      // O `DropdownButtonFormField` só lê o valor inicial: recria o campo
      // quando as opções terminam de carregar.
      key: ValueKey<bool>(loading),
      label: 'Usuário vinculado (opcional)',
      loading: loading,
      enabled: enabled,
      value: controller.selectedUserId ?? _none,
      helperText:
          controller.usersError ??
          'Usuários da plataforma com acesso ao tenant ativo.',
      options: <AppDropdownOption<String>>[
        const AppDropdownOption(value: _none, label: 'Nenhum'),
        if (controller.linkedUserMissing)
          AppDropdownOption(
            value: controller.selectedUserId!,
            label: 'Usuário vinculado atual (fora da lista)',
          ),
        for (final user in controller.users)
          AppDropdownOption(value: user.id, label: user.label),
      ],
      onChanged: controller.selectUser,
    );
  }
}
