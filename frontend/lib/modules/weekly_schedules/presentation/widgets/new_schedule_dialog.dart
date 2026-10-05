import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../shared/components/buttons/app_primary_button.dart';
import '../../../../shared/components/buttons/app_secondary_button.dart';
import '../../../../shared/components/feedback/app_error_banner.dart';
import '../../../../shared/components/feedback/app_inline_notice.dart';
import '../../../../shared/components/forms/app_date_field.dart';
import '../../../../shared/components/forms/app_dropdown_field.dart';
import '../../data/models/schedule_lookups.dart';
import '../../data/models/schedule_week.dart';
import '../weekly_schedule_editor_args.dart';

const double _kDialogWidth = 440;

/// Diálogo "Novo horário": escola → turma e um dia qualquer da semana
/// (normalizado para segunda → domingo). Devolve os argumentos do editor.
class NewScheduleDialog extends StatefulWidget {
  const NewScheduleDialog({
    super.key,
    required this.schools,
    required this.classes,
    this.initialSchoolId,
  });

  final List<ScheduleSchool> schools;
  final List<ScheduleClass> classes;
  final String? initialSchoolId;

  static Future<WeeklyScheduleEditorArgs?> show(
    BuildContext context, {
    required List<ScheduleSchool> schools,
    required List<ScheduleClass> classes,
    String? initialSchoolId,
  }) => showDialog<WeeklyScheduleEditorArgs>(
    context: context,
    builder: (_) => NewScheduleDialog(
      schools: schools,
      classes: classes,
      initialSchoolId: initialSchoolId,
    ),
  );

  @override
  State<NewScheduleDialog> createState() => _NewScheduleDialogState();
}

class _NewScheduleDialogState extends State<NewScheduleDialog> {
  late String? _schoolId = widget.initialSchoolId;
  ScheduleClass? _class;
  DateTime? _date = DateTime.now();
  String? _error;

  List<ScheduleClass> get _classOptions =>
      widget.classes.where((c) => c.schoolId == _schoolId).toList();

  void _selectSchool(String? id) => setState(() {
    _schoolId = id;
    _class = null;
  });

  void _selectClass(String? id) => setState(
    () => _class = _classOptions.where((c) => c.id == id).firstOrNull,
  );

  void _submit() {
    final schoolClass = _class;
    final date = _date;
    if (schoolClass == null || date == null) {
      setState(() => _error = 'Selecione a turma e uma data válida.');
      return;
    }
    Navigator.of(context).pop(
      WeeklyScheduleEditorArgs.create(schoolClass: schoolClass, date: date),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Novo horário semanal'),
      content: SizedBox(
        width: _kDialogWidth,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            AppErrorBanner(message: _error),
            if (_error != null) AppDimensions.vGapMd,
            _SchoolClassFields(
              schools: widget.schools,
              classes: _classOptions,
              schoolId: _schoolId,
              classId: _class?.id,
              onSchool: _selectSchool,
              onClass: _selectClass,
            ),
            AppDimensions.vGapLg,
            _WeekField(
              date: _date,
              onChanged: (d) => setState(() => _date = d),
            ),
          ],
        ),
      ),
      actions: <Widget>[
        AppSecondaryButton(
          label: 'Cancelar',
          onPressed: () => Navigator.of(context).pop(),
        ),
        AppPrimaryButton(label: 'Montar horário', onPressed: _submit),
      ],
    );
  }
}

class _SchoolClassFields extends StatelessWidget {
  const _SchoolClassFields({
    required this.schools,
    required this.classes,
    required this.schoolId,
    required this.classId,
    required this.onSchool,
    required this.onClass,
  });

  final List<ScheduleSchool> schools;
  final List<ScheduleClass> classes;
  final String? schoolId;
  final String? classId;
  final ValueChanged<String?> onSchool;
  final ValueChanged<String?> onClass;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        AppDropdownField<String>(
          label: 'Escola',
          hint: 'Selecione a escola',
          value: schoolId,
          options: <AppDropdownOption<String>>[
            for (final s in schools)
              AppDropdownOption<String>(value: s.id, label: s.name),
          ],
          onChanged: onSchool,
        ),
        AppDimensions.vGapLg,
        AppDropdownField<String>(
          key: ValueKey<String>('new-class-$schoolId'),
          label: 'Turma',
          hint: 'Selecione a turma',
          value: classId,
          options: <AppDropdownOption<String>>[
            for (final c in classes)
              AppDropdownOption<String>(value: c.id, label: c.label),
          ],
          onChanged: onClass,
        ),
      ],
    );
  }
}

/// Data qualquer da semana + a semana normalizada (segunda a domingo).
class _WeekField extends StatelessWidget {
  const _WeekField({required this.date, required this.onChanged});

  final DateTime? date;
  final ValueChanged<DateTime?> onChanged;

  @override
  Widget build(BuildContext context) {
    final value = date;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        AppDateField(
          label: 'Um dia da semana',
          value: value,
          required: true,
          onChanged: onChanged,
        ),
        AppDimensions.vGapSm,
        AppInlineNotice(
          icon: Icons.date_range_outlined,
          message: value == null
              ? null
              : 'Semana de ${formatScheduleWeek(scheduleMondayOf(value))} '
                    '(segunda a domingo).',
        ),
      ],
    );
  }
}
