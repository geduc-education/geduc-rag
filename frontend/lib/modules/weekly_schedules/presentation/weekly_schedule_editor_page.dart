import 'package:flutter/material.dart';
import 'package:flutter_modular/flutter_modular.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../shared/components/feedback/app_confirm_dialog.dart';
import '../../../shared/components/feedback/app_error_banner.dart';
import '../../../shared/components/feedback/app_state_views.dart';
import '../../../shared/components/feedback/app_toast.dart';
import '../data/models/schedule_day.dart';
import '../data/weekly_schedules_repository.dart';
import 'weekly_schedule_editor_args.dart';
import 'weekly_schedule_editor_controller.dart';
import 'widgets/lesson_form_dialog.dart';
import 'widgets/schedule_editor_header.dart';
import 'widgets/schedule_week_grid.dart';

const String _listRoute = '/home/weekly-schedules';

/// Editor da semana (segunda → domingo) de uma turma: grade de 7 dias com
/// as aulas, adicionar/editar/remover aula, registros e salvar.
class WeeklyScheduleEditorPage extends StatefulWidget {
  const WeeklyScheduleEditorPage({super.key, required this.args});

  /// `null` (URL direta sem argumentos) volta para a lista.
  final WeeklyScheduleEditorArgs? args;

  @override
  State<WeeklyScheduleEditorPage> createState() =>
      _WeeklyScheduleEditorPageState();
}

class _WeeklyScheduleEditorPageState extends State<WeeklyScheduleEditorPage> {
  late final WeeklyScheduleEditorController _controller =
      WeeklyScheduleEditorController(inject<IWeeklySchedulesRepository>());

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final args = widget.args;
      args == null ? context.navigate(_listRoute) : _controller.open(args);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _toast(String? error, [String? success]) {
    final message = error ?? success;
    if (!mounted || message == null) return;
    showAppToast(
      context,
      message,
      type: error == null ? AppToastType.success : AppToastType.error,
    );
  }

  Future<void> _lessonDialog(ScheduleDay day, [int? index]) =>
      LessonFormDialog.show(
        context,
        day: day,
        subjects: _controller.subjects,
        slots: _controller.slots,
        usedSlotIds: _controller.usedSlotIds(day.date, except: index),
        initial: index == null ? null : day.lessons[index],
        onSubmit: (draft) => index == null
            ? _controller.addLesson(day.date, draft)
            : _controller.updateLesson(day.date, index, draft),
      );

  Future<void> _toggle(
    ScheduleDay day,
    int index, {
    bool? content,
    bool? attendance,
  }) async {
    final error = await _controller.toggleRecord(
      day.date,
      index,
      content: content,
      attendance: attendance,
    );
    _toast(error, 'Registro da aula atualizado.');
  }

  Future<void> _save() async {
    if (await _controller.save()) _toast(null, 'Horário salvo.');
  }

  Future<void> _back() async {
    if (_controller.dirty) {
      final leave = await AppConfirmDialog.show(
        context,
        title: 'Descartar alterações',
        message: 'As alterações não salvas desta semana serão perdidas.',
        confirmLabel: 'Descartar',
        danger: true,
      );
      if (!leave) return;
    }
    if (mounted) context.navigate(_listRoute);
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
            ScheduleEditorHeader(
              controller: _controller,
              classLabel: widget.args?.classLabel ?? '',
              onBack: _back,
              onSave: _save,
            ),
            AppDimensions.vGapLg,
            AppErrorBanner(message: _controller.saveError),
            if (_controller.saveError != null) AppDimensions.vGapMd,
            Expanded(child: _body()),
          ],
        ),
      ),
    );
  }

  Widget _body() {
    switch (_controller.state) {
      case ScheduleEditorState.loading:
        return const AppLoadingView();
      case ScheduleEditorState.error:
        return AppErrorView(
          message: _controller.loadError ?? 'Erro ao carregar.',
          onRetry: () => _controller.open(widget.args!),
        );
      case ScheduleEditorState.ready:
        return ScheduleWeekGrid(
          days: _controller.days,
          highlightedDate: _controller.highlightedDate,
          onAdd: _lessonDialog,
          onEdit: _lessonDialog,
          onRemove: (day, i) => _toast(_controller.removeLesson(day.date, i)),
          onToggle: _toggle,
        );
    }
  }
}
