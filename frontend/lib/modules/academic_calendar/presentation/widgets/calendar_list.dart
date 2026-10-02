import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/colors_app.dart';
import '../../../../shared/components/feedback/app_state_views.dart';
import '../../../../shared/utils/app_date_formats.dart';
import '../../data/models/academic_calendar.dart';
import '../academic_calendars_list_controller.dart';
import 'calendar_accent_card.dart';

/// Lista de calendários do tenant: tocar abre o calendário; ações de editar
/// e excluir em cada item. O aberto fica destacado.
class CalendarList extends StatelessWidget {
  const CalendarList({
    super.key,
    required this.controller,
    required this.selectedId,
    required this.onOpen,
    required this.onEdit,
    required this.onDelete,
  });

  final AcademicCalendarsListController controller;
  final String? selectedId;
  final ValueChanged<AcademicCalendar> onOpen;
  final ValueChanged<AcademicCalendar> onEdit;
  final ValueChanged<AcademicCalendar> onDelete;

  @override
  Widget build(BuildContext context) {
    return switch (controller.state) {
      AcademicCalendarsViewState.loading => const AppLoadingView(),
      AcademicCalendarsViewState.error => AppErrorView(
        message: controller.error ?? 'Não foi possível carregar.',
        onRetry: controller.load,
      ),
      AcademicCalendarsViewState.empty => const AppEmptyView(
        message: 'Nenhum calendário encontrado para os filtros.',
        icon: Icons.event_busy_outlined,
      ),
      AcademicCalendarsViewState.ready => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          for (final calendar in controller.calendars) ...<Widget>[
            _CalendarTile(
              calendar: calendar,
              scope: _scopeOf(calendar),
              selected: calendar.id == selectedId,
              onOpen: () => onOpen(calendar),
              onEdit: () => onEdit(calendar),
              onDelete: () => onDelete(calendar),
            ),
            AppDimensions.vGapMd,
          ],
        ],
      ),
    };
  }

  String _scopeOf(AcademicCalendar calendar) => calendar.allSchools
      ? 'Todas as escolas'
      : calendar.schoolIds.map(controller.schoolName).join(', ');
}

class _CalendarTile extends StatelessWidget {
  const _CalendarTile({
    required this.calendar,
    required this.scope,
    required this.selected,
    required this.onOpen,
    required this.onEdit,
    required this.onDelete,
  });

  final AcademicCalendar calendar;
  final String scope;
  final bool selected;
  final VoidCallback onOpen;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onOpen,
      borderRadius: AppDimensions.borderRadius,
      child: CalendarAccentCard(
        accent: selected
            ? context.colors.primary
            : context.colors.borderDefault,
        child: Row(
          children: <Widget>[
            Expanded(
              child: _TileInfo(calendar: calendar, scope: scope),
            ),
            AppDimensions.hGapSm,
            _TileActions(onEdit: onEdit, onDelete: onDelete),
          ],
        ),
      ),
    );
  }
}

class _TileInfo extends StatelessWidget {
  const _TileInfo({required this.calendar, required this.scope});

  final AcademicCalendar calendar;
  final String scope;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final styles = context.textStyles;
    final period =
        '${formatDate(calendar.startDate)} a ${formatDate(calendar.endDate)}';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          calendar.name,
          style: styles.textRegularBold.copyWith(color: colors.textPrimary),
        ),
        AppDimensions.vGapXs,
        Text('Ano ${calendar.year} • $period', style: styles.textSmall),
        AppDimensions.vGapXs,
        Text(scope, style: styles.textSmall.copyWith(color: colors.textMuted)),
      ],
    );
  }
}

class _TileActions extends StatelessWidget {
  const _TileActions({required this.onEdit, required this.onDelete});

  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        IconButton(
          tooltip: 'Editar calendário',
          color: colors.info500,
          icon: const Icon(Icons.edit_outlined, size: AppDimensions.iconSizeMd),
          onPressed: onEdit,
        ),
        IconButton(
          tooltip: 'Excluir calendário',
          color: colors.danger500,
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
