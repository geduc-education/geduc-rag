import 'package:flutter/material.dart';
import 'package:flutter_modular/flutter_modular.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../shared/components/feedback/app_confirm_dialog.dart';
import '../../../shared/components/feedback/app_state_views.dart';
import '../../../shared/components/feedback/app_toast.dart';
import '../../../shared/components/navigation/app_pager.dart';
import '../data/models/weekly_schedule.dart';
import 'weekly_schedule_editor_args.dart';
import 'weekly_schedules_list_controller.dart';
import 'widgets/new_schedule_dialog.dart';
import 'widgets/replicate_schedule_dialog.dart';
import 'widgets/replication_summary_dialog.dart';
import 'widgets/schedule_filter_bar.dart';
import 'widgets/schedule_list_tile.dart';

/// Listagem dos horários semanais do tenant ativo com filtros escola →
/// turma e período, paginação e as ações editar, replicar e excluir.
class WeeklySchedulesListPage extends StatefulWidget {
  const WeeklySchedulesListPage({super.key});

  @override
  State<WeeklySchedulesListPage> createState() =>
      _WeeklySchedulesListPageState();
}

class _WeeklySchedulesListPageState extends State<WeeklySchedulesListPage> {
  late final WeeklySchedulesListController _controller;

  @override
  void initState() {
    super.initState();
    _controller = inject<WeeklySchedulesListController>();
    // Pós-frame: o controller é singleton do shell (ver `UsersListPage`).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _controller.bootstrap();
    });
  }

  Future<void> _openEditor(WeeklyScheduleEditorArgs args) async {
    await context.pushNamed<bool>('./editor', arguments: args);
    if (mounted) _controller.load();
  }

  Future<void> _create() async {
    final args = await NewScheduleDialog.show(
      context,
      schools: _controller.schools,
      classes: _controller.classes,
      initialSchoolId: _controller.schoolId,
    );
    if (args != null && mounted) await _openEditor(args);
  }

  void _edit(WeeklyScheduleSummary schedule) => _openEditor(
    WeeklyScheduleEditorArgs.edit(
      scheduleId: schedule.id,
      classLabel: _controller.className(schedule.schoolClassId),
      schoolId: _controller.classById(schedule.schoolClassId)?.schoolId,
    ),
  );

  void _toast(String? error, String success) {
    if (!mounted) return;
    showAppToast(
      context,
      error ?? success,
      type: error == null ? AppToastType.success : AppToastType.error,
    );
  }

  Future<void> _remove(WeeklyScheduleSummary schedule) async {
    final confirmed = await AppConfirmDialog.show(
      context,
      title: 'Excluir horário',
      message:
          'O horário da semana ${schedule.periodLabel} da turma '
          '${_controller.className(schedule.schoolClassId)} será excluído.',
      confirmLabel: 'Excluir',
      danger: true,
    );
    if (!confirmed) return;
    _toast(await _controller.remove(schedule), 'Horário excluído.');
  }

  Future<void> _replicate(WeeklyScheduleSummary schedule) async {
    final done = await ReplicateScheduleDialog.show(
      context,
      source: schedule,
      onSubmit: (targets) => _controller.replicate(schedule, targets),
    );
    final outcome = _controller.lastReplication;
    if (!done || outcome == null || !mounted) return;
    await ReplicationSummaryDialog.show(
      context,
      outcome: outcome,
      subjectName: _controller.subjectName,
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) => Padding(
        padding: AppDimensions.paddingXl,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            ScheduleFilterBar(controller: _controller, onCreate: _create),
            AppDimensions.vGapLg,
            Expanded(child: _body()),
            if (_controller.state == WeeklySchedulesViewState.ready) ...[
              AppDimensions.vGapMd,
              AppPager(
                label:
                    'Página ${_controller.page} de ${_controller.pageCount} · '
                    '${_controller.total} horário(s)',
                onPrevious: _controller.hasPrevious
                    ? _controller.previousPage
                    : null,
                onNext: _controller.hasNext ? _controller.nextPage : null,
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _body() {
    switch (_controller.state) {
      case WeeklySchedulesViewState.loading:
        return const AppLoadingView();
      case WeeklySchedulesViewState.error:
        return AppErrorView(
          message: _controller.error ?? 'Erro ao carregar.',
          onRetry: _controller.load,
        );
      case WeeklySchedulesViewState.empty:
        return const AppEmptyView(
          message: 'Nenhum horário semanal encontrado.',
          icon: Icons.view_week_outlined,
        );
      case WeeklySchedulesViewState.ready:
        return ListView.separated(
          itemCount: _controller.items.length,
          separatorBuilder: (_, _) => AppDimensions.vGapSm,
          itemBuilder: (_, i) {
            final schedule = _controller.items[i];
            return ScheduleListTile(
              schedule: schedule,
              classLabel: _controller.className(schedule.schoolClassId),
              onEdit: () => _edit(schedule),
              onReplicate: () => _replicate(schedule),
              onRemove: () => _remove(schedule),
            );
          },
        );
    }
  }
}
