import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../shared/components/buttons/app_primary_button.dart';
import '../../../../shared/components/buttons/app_secondary_button.dart';
import '../../../../shared/components/feedback/app_error_banner.dart';
import '../../../../shared/components/forms/app_date_field.dart';
import '../../../../shared/components/forms/app_dropdown_field.dart';
import '../../../../shared/components/forms/app_text_field.dart';
import '../../../../shared/utils/validators.dart';
import '../../data/models/calendar_event.dart';
import '../../data/models/calendar_school.dart';

/// Envia o registro; devolve a mensagem de erro ou `null` em caso de sucesso.
typedef CalendarEventSubmit = Future<String?> Function(CalendarEventInput);

/// Diálogo "Registrar datas" / "Editar registro". Fecha com `true` quando o
/// [onSubmit] conclui sem erro; o erro fica no [AppErrorBanner] do diálogo.
class CalendarEventFormDialog extends StatefulWidget {
  const CalendarEventFormDialog({
    super.key,
    required this.schools,
    required this.onSubmit,
    this.initial,
  });

  final List<CalendarSchool> schools;
  final CalendarEventSubmit onSubmit;

  /// Registro em edição; `null` = novo registro.
  final CalendarEvent? initial;

  static Future<bool> show(
    BuildContext context, {
    required List<CalendarSchool> schools,
    required CalendarEventSubmit onSubmit,
    CalendarEvent? initial,
  }) async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => CalendarEventFormDialog(
        schools: schools,
        onSubmit: onSubmit,
        initial: initial,
      ),
    );
    return saved ?? false;
  }

  @override
  State<CalendarEventFormDialog> createState() =>
      _CalendarEventFormDialogState();
}

class _CalendarEventFormDialogState extends State<CalendarEventFormDialog> {
  final _formKey = GlobalKey<FormState>();
  late final _title = TextEditingController(text: widget.initial?.title);
  late final _description = TextEditingController(
    text: widget.initial?.description,
  );
  late final _observation = TextEditingController(
    text: widget.initial?.observation,
  );
  late CalendarEventType _type =
      widget.initial?.type ?? CalendarEventType.diaLetivo;
  late DateTime? _date = widget.initial?.date;
  late String? _schoolId = widget.initial?.schoolId;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _observation.dispose();
    super.dispose();
  }

  static String? _trimmedOrNull(TextEditingController c) {
    final text = c.text.trim();
    return text.isEmpty ? null : text;
  }

  Future<void> _submit() async {
    final date = _date;
    if (!(_formKey.currentState?.validate() ?? false) || date == null) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    final error = await widget.onSubmit(
      CalendarEventInput(
        title: _title.text.trim(),
        type: _type,
        date: date,
        schoolId: _schoolId,
        description: _trimmedOrNull(_description),
        observation: _trimmedOrNull(_observation),
      ),
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
    final editing = widget.initial != null;
    return AlertDialog(
      title: Text(editing ? 'Editar registro' : 'Registrar datas'),
      content: SizedBox(
        width: 480,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: _EventFields(
              error: _error,
              title: _title,
              description: _description,
              observation: _observation,
              type: _type,
              date: _date,
              schoolId: _schoolId,
              schools: widget.schools,
              onType: (t) => setState(() => _type = t),
              onDate: (d) => _date = d,
              onSchool: (id) => setState(() => _schoolId = id),
            ),
          ),
        ),
      ),
      actions: <Widget>[
        AppSecondaryButton(
          label: 'Cancelar',
          onPressed: _saving ? null : () => Navigator.of(context).pop(false),
        ),
        AppPrimaryButton(
          label: editing ? 'Salvar' : 'Registrar',
          loading: _saving,
          onPressed: _submit,
        ),
      ],
    );
  }
}

class _EventFields extends StatelessWidget {
  const _EventFields({
    required this.error,
    required this.title,
    required this.description,
    required this.observation,
    required this.type,
    required this.date,
    required this.schoolId,
    required this.schools,
    required this.onType,
    required this.onDate,
    required this.onSchool,
  });

  final String? error;
  final TextEditingController title;
  final TextEditingController description;
  final TextEditingController observation;
  final CalendarEventType type;
  final DateTime? date;
  final String? schoolId;
  final List<CalendarSchool> schools;
  final ValueChanged<CalendarEventType> onType;
  final ValueChanged<DateTime?> onDate;
  final ValueChanged<String?> onSchool;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        AppErrorBanner(message: error),
        if (error != null) AppDimensions.vGapMd,
        AppTextField(
          label: 'Título',
          controller: title,
          autofocus: true,
          validator: (v) => Validators.required(v, field: 'Título'),
        ),
        AppDimensions.vGapLg,
        AppDropdownField<CalendarEventType>(
          label: 'Tipo de registro',
          value: type,
          options: <AppDropdownOption<CalendarEventType>>[
            for (final t in CalendarEventType.values)
              AppDropdownOption<CalendarEventType>(value: t, label: t.label),
          ],
          onChanged: (t) => onType(t ?? type),
        ),
        AppDimensions.vGapLg,
        AppDateField(
          label: 'Data',
          value: date,
          required: true,
          onChanged: onDate,
        ),
        AppDimensions.vGapLg,
        _SchoolField(schools: schools, value: schoolId, onChanged: onSchool),
        AppDimensions.vGapLg,
        AppTextField(label: 'Descrição', controller: description),
        AppDimensions.vGapLg,
        AppTextField(label: 'Observação', controller: observation, maxLines: 3),
      ],
    );
  }
}

class _SchoolField extends StatelessWidget {
  const _SchoolField({
    required this.schools,
    required this.value,
    required this.onChanged,
  });

  static const String _networkLabel =
      'Toda a rede ($calendarNetworkScopeLabel)';

  final List<CalendarSchool> schools;
  final String? value;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    return AppDropdownField<String?>(
      label: 'Escola',
      value: value,
      hint: _networkLabel,
      options: <AppDropdownOption<String?>>[
        const AppDropdownOption<String?>(value: null, label: _networkLabel),
        for (final s in schools)
          AppDropdownOption<String?>(value: s.id, label: s.name),
      ],
      onChanged: onChanged,
    );
  }
}
