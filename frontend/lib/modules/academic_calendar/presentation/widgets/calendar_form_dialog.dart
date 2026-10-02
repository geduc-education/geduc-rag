import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../shared/components/buttons/app_primary_button.dart';
import '../../../../shared/components/buttons/app_secondary_button.dart';
import '../../../../shared/components/feedback/app_error_banner.dart';
import '../../../../shared/components/forms/app_date_field.dart';
import '../../../../shared/components/forms/app_dropdown_field.dart';
import '../../../../shared/components/forms/app_multi_select_chips.dart';
import '../../../../shared/components/forms/app_read_only_field.dart';
import '../../../../shared/components/forms/app_switch_row.dart';
import '../../../../shared/components/forms/app_text_field.dart';
import '../../../../shared/utils/app_date_formats.dart';
import '../../../../shared/utils/validators.dart';
import '../../data/academic_calendar_repository.dart';
import '../../data/models/academic_calendar.dart';
import '../../data/models/calendar_school.dart';
import '../academic_calendar_form_controller.dart';

const double _kDialogWidth = 520;

/// Diálogo "Novo calendário" / "Editar calendário". Fecha devolvendo o
/// calendário salvo; erros ficam no [AppErrorBanner] do diálogo.
class CalendarFormDialog extends StatefulWidget {
  const CalendarFormDialog({
    super.key,
    required this.repository,
    required this.schools,
    required this.yearOptions,
    required this.defaultYear,
    this.editing,
  });

  final IAcademicCalendarRepository repository;
  final List<CalendarSchool> schools;
  final List<int> yearOptions;
  final int defaultYear;

  /// Calendário em edição; `null` = criação.
  final AcademicCalendar? editing;

  static Future<AcademicCalendar?> show(
    BuildContext context, {
    required IAcademicCalendarRepository repository,
    required List<CalendarSchool> schools,
    required List<int> yearOptions,
    required int defaultYear,
    AcademicCalendar? editing,
  }) => showDialog<AcademicCalendar>(
    context: context,
    builder: (_) => CalendarFormDialog(
      repository: repository,
      schools: schools,
      yearOptions: yearOptions,
      defaultYear: defaultYear,
      editing: editing,
    ),
  );

  @override
  State<CalendarFormDialog> createState() => _CalendarFormDialogState();
}

class _CalendarFormDialogState extends State<CalendarFormDialog> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.editing?.name);
  late final _controller = AcademicCalendarFormController(
    widget.repository,
    defaultYear: widget.defaultYear,
    editing: widget.editing,
  );

  @override
  void dispose() {
    _name.dispose();
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final saved = await _controller.save(_name.text);
    if (saved != null && mounted) Navigator.of(context).pop(saved);
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) => AlertDialog(
        title: Text(
          _controller.isEditing ? 'Editar calendário' : 'Novo calendário',
        ),
        content: SizedBox(
          width: _kDialogWidth,
          child: Form(
            key: _formKey,
            child: SingleChildScrollView(
              child: _CalendarFields(
                controller: _controller,
                name: _name,
                schools: widget.schools,
                yearOptions: widget.yearOptions,
              ),
            ),
          ),
        ),
        actions: <Widget>[
          AppSecondaryButton(
            label: 'Cancelar',
            onPressed: _controller.saving
                ? null
                : () => Navigator.of(context).pop(),
          ),
          AppPrimaryButton(
            label: _controller.isEditing ? 'Salvar' : 'Criar',
            loading: _controller.saving,
            onPressed: _submit,
          ),
        ],
      ),
    );
  }
}

class _CalendarFields extends StatelessWidget {
  const _CalendarFields({
    required this.controller,
    required this.name,
    required this.schools,
    required this.yearOptions,
  });

  final AcademicCalendarFormController controller;
  final TextEditingController name;
  final List<CalendarSchool> schools;
  final List<int> yearOptions;

  @override
  Widget build(BuildContext context) {
    final error = controller.error;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        AppErrorBanner(message: error),
        if (error != null) AppDimensions.vGapMd,
        AppTextField(
          label: 'Nome',
          controller: name,
          autofocus: true,
          validator: _validateName,
        ),
        AppDimensions.vGapLg,
        if (controller.isEditing)
          _ReadOnlyPeriod(calendar: controller.editing!)
        else
          _PeriodFields(controller: controller, yearOptions: yearOptions),
        AppDimensions.vGapLg,
        _SchoolsSection(controller: controller, schools: schools),
      ],
    );
  }

  static String? _validateName(String? value) {
    final required = Validators.required(value, field: 'Nome');
    if (required != null) return required;
    return value!.trim().length < 2 ? 'Informe ao menos 2 caracteres.' : null;
  }
}

class _SchoolsSection extends StatelessWidget {
  const _SchoolsSection({required this.controller, required this.schools});

  final AcademicCalendarFormController controller;
  final List<CalendarSchool> schools;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        AppSwitchRow(
          label: 'Todas as escolas',
          description: 'Desmarque para escolher as escolas do calendário.',
          value: controller.allSchools,
          onChanged: controller.setAllSchools,
        ),
        if (!controller.allSchools) ...<Widget>[
          AppDimensions.vGapMd,
          AppMultiSelectChips(
            label: 'Escolas',
            emptyHint: 'Nenhuma escola cadastrada no tenant.',
            options: <MultiSelectOption>[
              for (final s in schools)
                MultiSelectOption(id: s.id, label: s.label),
            ],
            selectedIds: controller.schoolIds,
            onToggle: controller.toggleSchool,
          ),
        ],
      ],
    );
  }
}

class _PeriodFields extends StatelessWidget {
  const _PeriodFields({required this.controller, required this.yearOptions});

  final AcademicCalendarFormController controller;
  final List<int> yearOptions;

  @override
  Widget build(BuildContext context) {
    final year = controller.year;
    final years = <int>{...yearOptions, year}.toList()..sort();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        AppDropdownField<int>(
          label: 'Ano letivo',
          value: year,
          options: <AppDropdownOption<int>>[
            for (final y in years)
              AppDropdownOption<int>(value: y, label: '$y'),
          ],
          onChanged: (y) => controller.setYear(y ?? year),
        ),
        AppDimensions.vGapLg,
        AppDateField(
          label: 'Início',
          value: controller.startDate,
          required: true,
          onChanged: controller.setStartDate,
        ),
        AppDimensions.vGapLg,
        AppDateField(
          label: 'Fim',
          value: controller.endDate,
          required: true,
          onChanged: controller.setEndDate,
        ),
      ],
    );
  }
}

class _ReadOnlyPeriod extends StatelessWidget {
  const _ReadOnlyPeriod({required this.calendar});

  final AcademicCalendar calendar;

  @override
  Widget build(BuildContext context) {
    final period =
        '${formatDate(calendar.startDate)} a ${formatDate(calendar.endDate)}';
    return AppReadOnlyField(
      label: 'Ano letivo e período (não editáveis)',
      value: '${calendar.year} • $period',
      icon: Icons.lock_outline,
    );
  }
}
