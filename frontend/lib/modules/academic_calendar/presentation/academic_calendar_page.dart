import 'package:flutter/material.dart';
import 'package:flutter_modular/flutter_modular.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../shared/components/feedback/app_confirm_dialog.dart';
import '../../../shared/components/feedback/app_state_views.dart';
import '../../../shared/components/feedback/app_toast.dart';
import '../data/academic_calendar_repository.dart';
import '../data/models/academic_calendar.dart';
import '../data/models/calendar_day.dart';
import 'academic_calendars_list_controller.dart';
import 'calendar_days_controller.dart';
import 'widgets/calendar_day_form_dialog.dart';
import 'widgets/calendar_filter_card.dart';
import 'widgets/calendar_form_dialog.dart';
import 'widgets/calendar_list.dart';
import 'widgets/calendar_viewer.dart';

/// Página do Calendário Acadêmico: seleção do calendário (filtros e lista),
/// cadastro/edição/exclusão e o calendário aberto com as visões dia, semana,
/// mês e ano, o quantitativo por tipo e a edição de cada dia.
class AcademicCalendarPage extends StatefulWidget {
  const AcademicCalendarPage({super.key});

  @override
  State<AcademicCalendarPage> createState() => _AcademicCalendarPageState();
}

class _AcademicCalendarPageState extends State<AcademicCalendarPage> {
  late final AcademicCalendarsListController _list;
  late final CalendarDaysController _days;
  late final IAcademicCalendarRepository _repository;

  @override
  void initState() {
    super.initState();
    _list = inject<AcademicCalendarsListController>();
    _days = inject<CalendarDaysController>();
    _repository = inject<IAcademicCalendarRepository>();
    // Pós-frame: notificar durante o build dispararia "setState() during build".
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _list.ensureLoaded();
    });
  }

  Future<void> _openForm([AcademicCalendar? editing]) async {
    final saved = await CalendarFormDialog.show(
      context,
      repository: _repository,
      schools: _list.schools,
      yearOptions: _list.yearOptions,
      defaultYear: _list.year ?? DateTime.now().year,
      editing: editing,
    );
    if (saved == null || !mounted) return;
    showAppToast(
      context,
      editing == null ? 'Calendário criado.' : 'Calendário atualizado.',
      type: AppToastType.success,
    );
    _list.load();
    if (editing == null) {
      _days.open(saved);
    } else {
      _days.replaceCalendar(saved);
    }
  }

  Future<void> _confirmDelete(AcademicCalendar calendar) async {
    final confirmed = await AppConfirmDialog.show(
      context,
      title: 'Excluir calendário',
      message:
          'Excluir "${calendar.name}" e todos os seus dias? Esta ação não '
          'pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    );
    if (!confirmed || !mounted) return;
    final error = await _list.remove(calendar);
    if (!mounted) return;
    if (error == null && _days.calendar?.id == calendar.id) _days.close();
    showAppToast(
      context,
      error ?? 'Calendário excluído.',
      type: error == null ? AppToastType.success : AppToastType.error,
    );
  }

  Future<void> _editDay(CalendarDay day) async {
    final saved = await CalendarDayFormDialog.show(
      context,
      day: day,
      onSubmit: (input) => _days.updateDay(day, input),
    );
    if (!saved || !mounted) return;
    showAppToast(context, 'Dia atualizado.', type: AppToastType.success);
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge(<Listenable>[_list, _days]),
      builder: (context, _) => SingleChildScrollView(
        padding: AppDimensions.paddingXl,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            CalendarFilterCard(
              controller: _list,
              onCreate: _openForm,
              child: CalendarList(
                controller: _list,
                selectedId: _days.calendar?.id,
                onOpen: _days.open,
                onEdit: _openForm,
                onDelete: _confirmDelete,
              ),
            ),
            AppDimensions.vGapXl,
            if (_days.calendar == null)
              const AppEmptyView(
                message: 'Selecione um calendário para ver e editar os dias.',
                icon: Icons.calendar_month_outlined,
              )
            else
              CalendarViewer(controller: _days, onEditDay: _editDay),
          ],
        ),
      ),
    );
  }
}
