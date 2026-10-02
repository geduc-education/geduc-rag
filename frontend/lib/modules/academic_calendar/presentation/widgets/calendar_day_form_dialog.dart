import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../shared/components/buttons/app_primary_button.dart';
import '../../../../shared/components/buttons/app_secondary_button.dart';
import '../../../../shared/components/feedback/app_error_banner.dart';
import '../../../../shared/components/feedback/app_inline_notice.dart';
import '../../../../shared/components/forms/app_dropdown_field.dart';
import '../../../../shared/components/forms/app_text_field.dart';
import '../../../../shared/utils/app_date_formats.dart';
import '../../data/models/calendar_day.dart';
import '../../data/models/calendar_day_type.dart';
import 'calendar_day_type_style.dart';

const double _kDialogWidth = 440;

/// Limite de `description` no backend.
const int kCalendarDayDescriptionMax = 1000;

/// Envia a alteração do dia; devolve a mensagem de erro ou `null`.
typedef CalendarDaySubmit = Future<String?> Function(CalendarDayUpdate);

/// Diálogo "Editar dia": tipo e descrição. No domingo o tipo fica travado
/// (sempre não letivo) e só a descrição muda. Fecha com `true` ao salvar.
class CalendarDayFormDialog extends StatefulWidget {
  const CalendarDayFormDialog({
    super.key,
    required this.day,
    required this.onSubmit,
  });

  final CalendarDay day;
  final CalendarDaySubmit onSubmit;

  static Future<bool> show(
    BuildContext context, {
    required CalendarDay day,
    required CalendarDaySubmit onSubmit,
  }) async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => CalendarDayFormDialog(day: day, onSubmit: onSubmit),
    );
    return saved ?? false;
  }

  @override
  State<CalendarDayFormDialog> createState() => _CalendarDayFormDialogState();
}

class _CalendarDayFormDialogState extends State<CalendarDayFormDialog> {
  final _formKey = GlobalKey<FormState>();
  late final _description = TextEditingController(text: widget.day.description);
  late CalendarDayType _type = widget.day.type;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _description.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    final error = await widget.onSubmit(
      CalendarDayUpdate(
        type: widget.day.isSunday ? null : _type,
        description: _description.text,
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
    final day = widget.day;
    return AlertDialog(
      title: Text('${calendarWeekdayName(day.date)}, ${formatDate(day.date)}'),
      content: SizedBox(
        width: _kDialogWidth,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: _DayFields(
              error: _error,
              sunday: day.isSunday,
              type: _type,
              description: _description,
              onType: (t) => setState(() => _type = t),
            ),
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

class _DayFields extends StatelessWidget {
  const _DayFields({
    required this.error,
    required this.sunday,
    required this.type,
    required this.description,
    required this.onType,
  });

  final String? error;
  final bool sunday;
  final CalendarDayType type;
  final TextEditingController description;
  final ValueChanged<CalendarDayType> onType;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        AppErrorBanner(message: error),
        if (error != null) AppDimensions.vGapMd,
        AppDropdownField<CalendarDayType>(
          label: 'Tipo do dia',
          value: type,
          enabled: !sunday,
          options: <AppDropdownOption<CalendarDayType>>[
            for (final t in CalendarDayType.values)
              AppDropdownOption<CalendarDayType>(value: t, label: t.label),
          ],
          onChanged: (t) => onType(t ?? type),
        ),
        if (sunday) ...<Widget>[
          AppDimensions.vGapSm,
          const AppInlineNotice(
            message:
                'Domingo é sempre dia não letivo. Só a descrição pode ser '
                'alterada.',
            icon: Icons.lock_outline,
          ),
        ],
        AppDimensions.vGapLg,
        AppTextField(
          label: 'Descrição',
          hint: 'Opcional',
          controller: description,
          maxLines: 3,
          validator: _validateDescription,
        ),
      ],
    );
  }

  static String? _validateDescription(String? value) =>
      (value?.trim().length ?? 0) > kCalendarDayDescriptionMax
      ? 'Máximo de $kCalendarDayDescriptionMax caracteres.'
      : null;
}
