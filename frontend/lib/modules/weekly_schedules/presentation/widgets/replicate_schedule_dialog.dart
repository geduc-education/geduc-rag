import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/components/buttons/app_primary_button.dart';
import '../../../../shared/components/buttons/app_secondary_button.dart';
import '../../../../shared/components/feedback/app_error_banner.dart';
import '../../../../shared/components/feedback/app_inline_notice.dart';
import '../../../../shared/components/forms/app_date_field.dart';
import '../../../academic_calendar/data/models/calendar_day_type.dart';
import '../../data/models/schedule_week.dart';
import '../../data/models/weekly_schedule.dart';

const double _kDialogWidth = 480;

/// Máximo de semanas alvo aceito pelo backend.
const int kMaxReplicationTargets = 20;

/// Envia as segundas alvo; devolve a mensagem de erro ou `null`.
typedef ReplicateSubmit = Future<String?> Function(List<DateTime> mondays);

/// Diálogo "Replicar horário": escolhe as semanas alvo (por qualquer dia,
/// normalizado para a segunda) e replica. Fecha com `true` ao concluir.
class ReplicateScheduleDialog extends StatefulWidget {
  const ReplicateScheduleDialog({
    super.key,
    required this.source,
    required this.onSubmit,
  });

  final WeeklyScheduleSummary source;
  final ReplicateSubmit onSubmit;

  static Future<bool> show(
    BuildContext context, {
    required WeeklyScheduleSummary source,
    required ReplicateSubmit onSubmit,
  }) async {
    final done = await showDialog<bool>(
      context: context,
      builder: (_) =>
          ReplicateScheduleDialog(source: source, onSubmit: onSubmit),
    );
    return done ?? false;
  }

  @override
  State<ReplicateScheduleDialog> createState() =>
      _ReplicateScheduleDialogState();
}

class _ReplicateScheduleDialogState extends State<ReplicateScheduleDialog> {
  final List<DateTime> _targets = <DateTime>[];
  late DateTime? _pick = scheduleAddDays(widget.source.startDate, 7);
  bool _saving = false;
  String? _error;

  void _add() {
    final pick = _pick;
    final error = _validateTarget(pick);
    setState(() {
      _error = error;
      if (error == null) {
        _targets
          ..add(scheduleMondayOf(pick!))
          ..sort();
      }
    });
  }

  String? _validateTarget(DateTime? pick) {
    if (pick == null) return 'Informe uma data válida.';
    final monday = scheduleMondayOf(pick);
    if (isSameCalendarDay(monday, widget.source.startDate)) {
      return 'A semana alvo não pode ser a semana de origem.';
    }
    if (_targets.any((t) => isSameCalendarDay(t, monday))) {
      return 'Esta semana já foi adicionada.';
    }
    if (_targets.length >= kMaxReplicationTargets) {
      return 'No máximo $kMaxReplicationTargets semanas por replicação.';
    }
    return null;
  }

  Future<void> _submit() async {
    if (_targets.isEmpty) {
      setState(() => _error = 'Adicione ao menos uma semana alvo.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final error = await widget.onSubmit(List<DateTime>.of(_targets));
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
      title: Text('Replicar semana ${widget.source.periodLabel}'),
      content: SizedBox(
        width: _kDialogWidth,
        child: SingleChildScrollView(
          child: _ReplicateContent(
            error: _error,
            pick: _pick,
            targets: _targets,
            onPick: (d) => setState(() => _pick = d),
            onAdd: _saving ? null : _add,
            onRemove: _saving
                ? null
                : (t) => setState(() => _targets.remove(t)),
          ),
        ),
      ),
      actions: <Widget>[
        AppSecondaryButton(
          label: 'Cancelar',
          onPressed: _saving ? null : () => Navigator.of(context).pop(false),
        ),
        AppPrimaryButton(
          label: 'Replicar',
          icon: Icons.copy_all_outlined,
          loading: _saving,
          onPressed: _submit,
        ),
      ],
    );
  }
}

class _ReplicateContent extends StatelessWidget {
  const _ReplicateContent({
    required this.error,
    required this.pick,
    required this.targets,
    required this.onPick,
    required this.onAdd,
    required this.onRemove,
  });

  final String? error;
  final DateTime? pick;
  final List<DateTime> targets;
  final ValueChanged<DateTime?> onPick;
  final VoidCallback? onAdd;
  final ValueChanged<DateTime>? onRemove;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        AppErrorBanner(message: error),
        if (error != null) AppDimensions.vGapMd,
        const AppInlineNotice(
          icon: Icons.info_outline,
          message:
              'Semanas que já têm horário serão sobrescritas; aulas com '
              'registro são preservadas. Aulas em dias não letivos da '
              'semana alvo são descartadas.',
        ),
        AppDimensions.vGapLg,
        _TargetPicker(value: pick, onChanged: onPick, onAdd: onAdd),
        AppDimensions.vGapMd,
        _TargetChips(targets: targets, onRemove: onRemove),
      ],
    );
  }
}

class _TargetPicker extends StatelessWidget {
  const _TargetPicker({
    required this.value,
    required this.onChanged,
    required this.onAdd,
  });

  final DateTime? value;
  final ValueChanged<DateTime?> onChanged;
  final VoidCallback? onAdd;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: <Widget>[
        Expanded(
          child: AppDateField(
            label: 'Um dia da semana alvo',
            value: value,
            onChanged: onChanged,
          ),
        ),
        AppDimensions.hGapMd,
        AppSecondaryButton(
          label: 'Adicionar semana',
          icon: Icons.add,
          onPressed: onAdd,
        ),
      ],
    );
  }
}

class _TargetChips extends StatelessWidget {
  const _TargetChips({required this.targets, required this.onRemove});

  final List<DateTime> targets;
  final ValueChanged<DateTime>? onRemove;

  @override
  Widget build(BuildContext context) {
    if (targets.isEmpty) {
      return Text(
        'Nenhuma semana alvo adicionada.',
        style: context.textStyles.textSmall,
      );
    }
    final remove = onRemove;
    return Wrap(
      spacing: AppDimensions.gapSm,
      runSpacing: AppDimensions.gapSm,
      children: <Widget>[
        for (final monday in targets)
          InputChip(
            label: Text(formatScheduleWeek(monday)),
            onDeleted: remove == null ? null : () => remove(monday),
          ),
      ],
    );
  }
}
