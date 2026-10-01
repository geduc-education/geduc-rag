import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/colors_app.dart';
import '../../../../shared/components/feedback/app_state_views.dart';
import '../../../../shared/utils/app_date_formats.dart';
import '../../data/models/calendar_event.dart';
import 'calendar_accent_card.dart';
import 'calendar_event_type_style.dart';

/// Lista "Registros do mês": um card por registro, com tipo, escopo,
/// observação e as ações de editar e excluir.
class CalendarMonthRecords extends StatelessWidget {
  const CalendarMonthRecords({
    super.key,
    required this.month,
    required this.events,
    required this.onEdit,
    required this.onDelete,
  });

  final DateTime month;
  final List<CalendarEvent> events;
  final ValueChanged<CalendarEvent> onEdit;
  final ValueChanged<CalendarEvent> onDelete;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(
          'Eventos cadastrados para ${calendarMonthName(month)}.',
          style: context.textStyles.textSmall,
        ),
        AppDimensions.vGapMd,
        if (events.isEmpty)
          const AppEmptyView(
            message: 'Nenhum registro neste mês.',
            icon: Icons.event_busy_outlined,
          ),
        for (final event in events) ...<Widget>[
          _RecordTile(
            event: event,
            onEdit: () => onEdit(event),
            onDelete: () => onDelete(event),
          ),
          AppDimensions.vGapMd,
        ],
      ],
    );
  }
}

class _RecordTile extends StatelessWidget {
  const _RecordTile({
    required this.event,
    required this.onEdit,
    required this.onDelete,
  });

  final CalendarEvent event;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final styles = context.textStyles;
    final details = <String>[
      if (event.description case final d? when d.trim().isNotEmpty) d,
      event.type.label,
      event.scopeName,
    ].join(' • ');
    final observation = event.observation?.trim() ?? '';
    return CalendarAccentCard(
      accent: event.type.accent(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Expanded(
                child: Text(
                  event.title.toUpperCase(),
                  style: styles.textRegularBold.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
              ),
              AppDimensions.hGapSm,
              Text(
                formatDate(event.date),
                style: styles.textSmallBold.copyWith(color: colors.info500),
              ),
            ],
          ),
          AppDimensions.vGapXs,
          Text(details, style: styles.textSmall),
          AppDimensions.vGapXs,
          Text(
            observation.isEmpty ? 'Sem observações cadastradas.' : observation,
            style: styles.textSmall.copyWith(color: colors.textMuted),
          ),
          AppDimensions.vGapMd,
          _RecordActions(onEdit: onEdit, onDelete: onDelete),
        ],
      ),
    );
  }
}

class _RecordActions extends StatelessWidget {
  const _RecordActions({required this.onEdit, required this.onDelete});

  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Row(
      children: <Widget>[
        IconButton.filled(
          tooltip: 'Editar',
          style: IconButton.styleFrom(
            backgroundColor: colors.info500,
            foregroundColor: colors.white,
          ),
          icon: const Icon(Icons.edit_outlined, size: AppDimensions.iconSizeMd),
          onPressed: onEdit,
        ),
        AppDimensions.hGapSm,
        IconButton.outlined(
          tooltip: 'Excluir',
          style: IconButton.styleFrom(
            foregroundColor: colors.danger500,
            side: BorderSide(color: colors.borderDefault),
          ),
          icon: const Icon(
            Icons.delete_outline,
            size: AppDimensions.iconSizeMd,
          ),
          onPressed: onDelete,
        ),
      ],
    );
  }
}
