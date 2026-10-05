import 'package:flutter/material.dart';

import '../../../../shared/components/forms/app_dropdown_field.dart';
import '../../data/models/school_class_model.dart';

/// Seletor de escola das telas de turma. Com [allLabel], inclui a opção
/// "todas" (valor vazio, entregue como `null` em [onChanged]).
///
/// O `AppDropdownField` só lê o valor inicial: a [Key] derivada das opções e
/// do valor força a reconstrução quando as escolas terminam de carregar.
class SchoolSelectField extends StatelessWidget {
  const SchoolSelectField({
    super.key,
    required this.label,
    required this.schools,
    required this.value,
    required this.onChanged,
    this.allLabel,
    this.loading = false,
    this.enabled = true,
    this.validator,
  });

  final String label;
  final List<SchoolOption> schools;
  final String? value;
  final ValueChanged<String?> onChanged;
  final String? allLabel;
  final bool loading;
  final bool enabled;
  final String? Function(String?)? validator;

  static const String _all = '';

  @override
  Widget build(BuildContext context) {
    final all = allLabel;
    return AppDropdownField<String>(
      key: ValueKey<String>('${schools.length}:${value ?? _all}'),
      label: label,
      hint: all == null ? 'Selecione a escola' : null,
      value: value ?? (all == null ? null : _all),
      loading: loading,
      enabled: enabled,
      validator: validator,
      options: <AppDropdownOption<String>>[
        if (all != null) AppDropdownOption<String>(value: _all, label: all),
        for (final school in schools)
          AppDropdownOption<String>(value: school.id, label: school.label),
      ],
      onChanged: (selected) =>
          onChanged(selected == null || selected == _all ? null : selected),
    );
  }
}
