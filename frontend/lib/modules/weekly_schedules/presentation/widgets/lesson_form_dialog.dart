import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../shared/components/buttons/app_primary_button.dart';
import '../../../../shared/components/buttons/app_secondary_button.dart';
import '../../../../shared/components/feedback/app_error_banner.dart';
import '../../../../shared/components/feedback/app_inline_notice.dart';
import '../../../../shared/components/forms/app_dropdown_field.dart';
import '../../../../shared/utils/app_date_formats.dart';
import '../../../academic_calendar/presentation/widgets/calendar_day_type_style.dart';
import '../../data/models/schedule_day.dart';
import '../../data/models/schedule_lookups.dart';
import '../schedule_lesson_rules.dart';

const double _kDialogWidth = 420;

/// Aplica a aula no editor; devolve a mensagem de erro ou `null`.
typedef LessonSubmit = String? Function(ScheduleLesson draft);

/// Diálogo "Adicionar/Editar aula": disciplina e horário de aula da escola
/// ([slots]). Horários já ocupados no dia ([usedSlotIds]) aparecem
/// desabilitados; sem horários cadastrados, mostra o aviso e não aplica. As
/// regras vêm do controller via [onSubmit]; o erro aparece no
/// [AppErrorBanner]. Fecha com `true` ao aplicar.
class LessonFormDialog extends StatefulWidget {
  const LessonFormDialog({
    super.key,
    required this.day,
    required this.subjects,
    required this.slots,
    required this.usedSlotIds,
    required this.onSubmit,
    this.initial,
  });

  final ScheduleDay day;
  final List<ScheduleSubject> subjects;
  final List<ScheduleLessonSlot> slots;

  /// Horários ocupados por outras aulas do dia (sem o da aula em edição).
  final Set<String> usedSlotIds;
  final LessonSubmit onSubmit;
  final ScheduleLesson? initial;

  static Future<bool> show(
    BuildContext context, {
    required ScheduleDay day,
    required List<ScheduleSubject> subjects,
    required List<ScheduleLessonSlot> slots,
    required Set<String> usedSlotIds,
    required LessonSubmit onSubmit,
    ScheduleLesson? initial,
  }) async {
    final applied = await showDialog<bool>(
      context: context,
      builder: (_) => LessonFormDialog(
        day: day,
        subjects: subjects,
        slots: slots,
        usedSlotIds: usedSlotIds,
        onSubmit: onSubmit,
        initial: initial,
      ),
    );
    return applied ?? false;
  }

  @override
  State<LessonFormDialog> createState() => _LessonFormDialogState();
}

class _LessonFormDialogState extends State<LessonFormDialog> {
  final _formKey = GlobalKey<FormState>();
  late String? _subjectId = widget.initial?.subjectId;
  late String? _slotId = widget.initial?.lessonSlotId;
  String? _error;

  /// Ativas + a disciplina atual da aula (mesmo se inativada depois).
  List<ScheduleSubject> get _options => widget.subjects
      .where((s) => s.active || s.id == widget.initial?.subjectId)
      .toList();

  bool get _hasSlots => widget.slots.isNotEmpty;

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final error = widget.onSubmit(
      ScheduleLesson(lessonSlotId: _slotId ?? '', subjectId: _subjectId ?? ''),
    );
    if (error == null) {
      Navigator.of(context).pop(true);
      return;
    }
    setState(() => _error = error);
  }

  @override
  Widget build(BuildContext context) {
    final day = widget.day;
    return AlertDialog(
      title: Text(
        '${widget.initial == null ? 'Adicionar' : 'Editar'} aula · '
        '${calendarWeekdayName(day.date)}, ${formatDate(day.date)}',
      ),
      content: SizedBox(
        width: _kDialogWidth,
        child: Form(
          key: _formKey,
          child: _LessonFields(
            error: _error,
            subjects: _options,
            subjectId: _subjectId,
            slots: widget.slots,
            usedSlotIds: widget.usedSlotIds,
            slotId: _slotId,
            onSubject: (v) => setState(() => _subjectId = v),
            onSlot: (v) => setState(() => _slotId = v),
          ),
        ),
      ),
      actions: <Widget>[
        AppSecondaryButton(
          label: 'Cancelar',
          onPressed: () => Navigator.of(context).pop(false),
        ),
        AppPrimaryButton(
          label: 'Aplicar',
          onPressed: _hasSlots ? _submit : null,
        ),
      ],
    );
  }
}

class _LessonFields extends StatelessWidget {
  const _LessonFields({
    required this.error,
    required this.subjects,
    required this.subjectId,
    required this.slots,
    required this.usedSlotIds,
    required this.slotId,
    required this.onSubject,
    required this.onSlot,
  });

  final String? error;
  final List<ScheduleSubject> subjects;
  final String? subjectId;
  final List<ScheduleLessonSlot> slots;
  final Set<String> usedSlotIds;
  final String? slotId;
  final ValueChanged<String?> onSubject;
  final ValueChanged<String?> onSlot;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        AppErrorBanner(message: error),
        if (error != null) AppDimensions.vGapMd,
        AppInlineNotice(
          message: slots.isEmpty ? noLessonSlotsMessage : null,
          icon: Icons.schedule_outlined,
          tone: AppNoticeTone.warning,
        ),
        if (slots.isEmpty) AppDimensions.vGapMd,
        AppDropdownField<String>(
          label: 'Horário',
          hint: 'Selecione o horário da aula',
          value: slotId,
          enabled: slots.isNotEmpty,
          options: <AppDropdownOption<String>>[
            for (final slot in slots)
              AppDropdownOption<String>(
                value: slot.id,
                label: slot.label,
                enabled: !usedSlotIds.contains(slot.id),
              ),
          ],
          helperText: usedSlotIds.isEmpty
              ? null
              : 'Horários já ocupados neste dia aparecem desabilitados.',
          validator: (v) => v == null ? 'Selecione o horário da aula.' : null,
          onChanged: onSlot,
        ),
        AppDimensions.vGapLg,
        AppDropdownField<String>(
          label: 'Disciplina',
          hint: 'Selecione a disciplina',
          value: subjectId,
          options: <AppDropdownOption<String>>[
            for (final s in subjects)
              AppDropdownOption<String>(value: s.id, label: s.name),
          ],
          validator: (v) => v == null ? 'Selecione a disciplina.' : null,
          onChanged: onSubject,
        ),
      ],
    );
  }
}
