import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/colors_app.dart';
import 'app_text_field.dart';

final DateFormat _format = DateFormat('dd/MM/yyyy');

/// Campo de data (`dd/MM/yyyy`) do design system: compõe o [AppTextField]
/// aceitando digitação e um botão de calendário no sufixo que abre o
/// `showDatePicker`.
///
/// [onChanged] recebe a data válida digitada/escolhida, ou `null` enquanto o
/// texto não forma uma data. A validação padrão exige data válida quando
/// [required] é `true`.
class AppDateField extends StatefulWidget {
  const AppDateField({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    this.required = false,
    this.firstDate,
    this.lastDate,
  });

  final String label;
  final DateTime? value;
  final ValueChanged<DateTime?> onChanged;
  final bool required;
  final DateTime? firstDate;
  final DateTime? lastDate;

  @override
  State<AppDateField> createState() => _AppDateFieldState();
}

class _AppDateFieldState extends State<AppDateField> {
  late final TextEditingController _text = TextEditingController(
    text: widget.value == null ? '' : _format.format(widget.value!),
  );

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  static DateTime? _parse(String text) {
    if (text.length != 10) return null;
    try {
      return _format.parseStrict(text);
    } on FormatException {
      return null;
    }
  }

  String? _validate(String? text) {
    final value = text?.trim() ?? '';
    if (value.isEmpty) return widget.required ? 'Informe a data.' : null;
    return _parse(value) == null ? 'Data inválida (dd/mm/aaaa).' : null;
  }

  Future<void> _pick() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _parse(_text.text) ?? now,
      firstDate: widget.firstDate ?? DateTime(now.year - 5),
      lastDate: widget.lastDate ?? DateTime(now.year + 5, 12, 31),
    );
    if (picked == null || !mounted) return;
    _text.text = _format.format(picked);
    widget.onChanged(picked);
  }

  @override
  Widget build(BuildContext context) {
    return AppTextField(
      label: widget.label,
      controller: _text,
      hint: 'dd/mm/aaaa',
      keyboardType: TextInputType.datetime,
      inputFormatters: <TextInputFormatter>[
        FilteringTextInputFormatter.allow(RegExp(r'[0-9/]')),
        LengthLimitingTextInputFormatter(10),
      ],
      validator: _validate,
      onChanged: (text) => widget.onChanged(_parse(text)),
      suffix: IconButton(
        tooltip: 'Escolher data',
        icon: Icon(
          Icons.calendar_today_outlined,
          size: AppDimensions.iconSizeMd,
          color: context.colors.textMuted,
        ),
        onPressed: _pick,
      ),
    );
  }
}
