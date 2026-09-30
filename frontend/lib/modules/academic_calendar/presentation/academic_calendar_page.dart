import 'package:flutter/material.dart';
import 'package:flutter_modular/flutter_modular.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../shared/components/feedback/app_confirm_dialog.dart';
import '../../../shared/components/feedback/app_state_views.dart';
import '../../../shared/components/feedback/app_toast.dart';
import '../../../shared/components/responsive/breakpoints.dart';
import '../data/models/calendar_event.dart';
import 'academic_calendar_controller.dart';
import 'widgets/calendar_event_form_dialog.dart';
import 'widgets/calendar_filter_card.dart';
import 'widgets/calendar_month_grid.dart';
import 'widgets/calendar_month_records.dart';
import 'widgets/calendar_panel.dart';
import 'widgets/calendar_summary_row.dart';

/// Página do Calendário Acadêmico: filtros, resumo do mês por tipo, a grade
/// mensal e a lista de registros do mês com edição e exclusão.
class AcademicCalendarPage extends StatefulWidget {
  const AcademicCalendarPage({super.key});

  @override
  State<AcademicCalendarPage> createState() => _AcademicCalendarPageState();
}

class _AcademicCalendarPageState extends State<AcademicCalendarPage> {
  late final AcademicCalendarController _controller;

  @override
  void initState() {
    super.initState();
    _controller = inject<AcademicCalendarController>();
    // Pós-frame: notificar durante o build dispararia "setState() during build".
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _controller.ensureLoaded();
    });
  }

  Future<void> _openForm([CalendarEvent? event]) async {
    final saved = await CalendarEventFormDialog.show(
      context,
      schools: _controller.schools,
      initial: event,
      onSubmit: (input) => _controller.save(input, id: event?.id),
    );
    if (!saved || !mounted) return;
    showAppToast(
      context,
      event == null ? 'Registro criado.' : 'Registro atualizado.',
      type: AppToastType.success,
    );
  }

  Future<void> _confirmDelete(CalendarEvent event) async {
    final confirmed = await AppConfirmDialog.show(
      context,
      title: 'Excluir registro',
      message: 'Excluir "${event.title}"? Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    );
    if (!confirmed || !mounted) return;
    final error = await _controller.delete(event.id);
    if (!mounted) return;
    showAppToast(
      context,
      error ?? 'Registro excluído.',
      type: error == null ? AppToastType.success : AppToastType.error,
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) => SingleChildScrollView(
        padding: AppDimensions.paddingXl,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            CalendarFilterCard(
              controller: _controller,
              onRegister: () => _openForm(),
            ),
            AppDimensions.vGapXl,
            CalendarSummaryRow(countOf: _controller.countOf),
            AppDimensions.vGapXl,
            _CalendarBody(
              controller: _controller,
              onEdit: _openForm,
              onDelete: _confirmDelete,
            ),
          ],
        ),
      ),
    );
  }
}

/// Calendário e registros lado a lado no desktop, empilhados abaixo disso.
class _CalendarBody extends StatelessWidget {
  const _CalendarBody({
    required this.controller,
    required this.onEdit,
    required this.onDelete,
  });

  final AcademicCalendarController controller;
  final ValueChanged<CalendarEvent> onEdit;
  final ValueChanged<CalendarEvent> onDelete;

  @override
  Widget build(BuildContext context) {
    if (controller.state == AcademicCalendarViewState.error) {
      return AppErrorView(
        message: controller.error ?? 'Não foi possível carregar o calendário.',
        onRetry: controller.load,
      );
    }
    final calendar = CalendarPanel(
      title: 'Calendário escolar',
      child: _LoadingOverlay(
        loading: controller.state == AcademicCalendarViewState.loading,
        child: CalendarMonthGrid(
          month: controller.month,
          eventsOn: controller.eventsOn,
          onPrevious: controller.previousMonth,
          onNext: controller.nextMonth,
        ),
      ),
    );
    final records = CalendarPanel(
      title: 'Registros do mês',
      child: CalendarMonthRecords(
        month: controller.month,
        events: controller.events,
        onEdit: onEdit,
        onDelete: onDelete,
      ),
    );
    return LayoutBuilder(
      builder: (context, constraints) {
        if (!AppBreakpoints.fromConstraints(constraints).isDesktop) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[calendar, AppDimensions.vGapXl, records],
          );
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Expanded(flex: 3, child: calendar),
            AppDimensions.hGapXl,
            Expanded(flex: 2, child: records),
          ],
        );
      },
    );
  }
}

/// Barra de progresso fina sobre o conteúdo enquanto o mês carrega — a grade
/// continua visível, sem pulo de layout.
class _LoadingOverlay extends StatelessWidget {
  const _LoadingOverlay({required this.loading, required this.child});

  final bool loading;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: <Widget>[
        child,
        if (loading)
          const Positioned(
            left: 0,
            right: 0,
            top: 0,
            child: LinearProgressIndicator(minHeight: 2),
          ),
      ],
    );
  }
}
