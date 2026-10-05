import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../shared/components/buttons/app_primary_button.dart';
import '../../../../shared/components/buttons/app_secondary_button.dart';
import '../../../../shared/components/feedback/app_error_banner.dart';
import '../../../../shared/components/forms/app_text_field.dart';
import '../../../../shared/components/forms/app_time_field.dart';
import '../../../../shared/utils/validators.dart';
import '../../data/models/lesson_slot.dart';

const double _kDialogWidth = 400;

/// Persiste o horário; devolve a mensagem de erro ou `null`.
typedef LessonSlotSubmit = Future<String?> Function(LessonSlotInput input);

/// Diálogo "Adicionar/Editar horário": nome, início e fim (`HH:mm`). O erro
/// do backend (sobreposição, nome repetido…) aparece no [AppErrorBanner].
/// Fecha com `true` ao salvar.
class LessonSlotFormDialog extends StatefulWidget {
  const LessonSlotFormDialog({super.key, required this.onSubmit, this.initial});

  final LessonSlotSubmit onSubmit;
  final LessonSlot? initial;

  static Future<bool> show(
    BuildContext context, {
    required LessonSlotSubmit onSubmit,
    LessonSlot? initial,
  }) async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) =>
          LessonSlotFormDialog(onSubmit: onSubmit, initial: initial),
    );
    return saved ?? false;
  }

  @override
  State<LessonSlotFormDialog> createState() => _LessonSlotFormDialogState();
}

class _LessonSlotFormDialogState extends State<LessonSlotFormDialog> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.initial?.name);
  late final _start = TextEditingController(text: widget.initial?.startTime);
  late final _end = TextEditingController(text: widget.initial?.endTime);
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _start.dispose();
    _end.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final start = _start.text.trim();
    final end = _end.text.trim();
    if (start.compareTo(end) >= 0) {
      setState(() => _error = 'O fim do horário deve ser depois do início.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final error = await widget.onSubmit(
      LessonSlotInput(name: _name.text, startTime: start, endTime: end),
    );
    if (!mounted) return;
    if (error == null) {
      Navigator.of(context).pop(true);
      return;
    }
    setState(() {
      _saving = false;
      _error = error;
    });
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.initial == null ? 'Novo horário' : 'Editar horário'),
      content: SizedBox(
        width: _kDialogWidth,
        child: Form(
          key: _formKey,
          child: _SlotFields(
            error: _error,
            enabled: !_saving,
            name: _name,
            start: _start,
            end: _end,
          ),
        ),
      ),
      actions: <Widget>[
        AppSecondaryButton(
          label: 'Cancelar',
          onPressed: _saving ? null : () => Navigator.of(context).pop(false),
        ),
        AppPrimaryButton(label: 'Salvar', loading: _saving, onPressed: _submit),
      ],
    );
  }
}

class _SlotFields extends StatelessWidget {
  const _SlotFields({
    required this.error,
    required this.enabled,
    required this.name,
    required this.start,
    required this.end,
  });

  final String? error;
  final bool enabled;
  final TextEditingController name;
  final TextEditingController start;
  final TextEditingController end;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        AppErrorBanner(message: error),
        if (error != null) AppDimensions.vGapMd,
        AppTextField(
          label: 'Nome',
          hint: 'Ex.: 1ª aula',
          controller: name,
          enabled: enabled,
          validator: (v) => Validators.required(v, field: 'Nome'),
        ),
        AppDimensions.vGapLg,
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            AppTimeField(label: 'Início', controller: start, enabled: enabled),
            AppDimensions.hGapLg,
            AppTimeField(label: 'Fim', controller: end, enabled: enabled),
          ],
        ),
      ],
    );
  }
}
