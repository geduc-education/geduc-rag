import 'package:flutter/material.dart';
import 'package:flutter_modular/flutter_modular.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/colors_app.dart';
import '../../../../shared/components/buttons/app_secondary_button.dart';
import '../../../../shared/components/feedback/app_confirm_dialog.dart';
import '../../../../shared/components/feedback/app_state_views.dart';
import '../../../../shared/components/feedback/app_toast.dart';
import '../../../../shared/components/layout/app_section_card.dart';
import '../../../../shared/utils/list_filters.dart';
import '../../data/lesson_slots_repository.dart';
import '../../data/models/lesson_slot.dart';
import '../lesson_slots_controller.dart';
import 'lesson_slot_form_dialog.dart';

/// Seção "Horários das aulas" do formulário de uma escola já salva: lista
/// na ordem da API, adicionar/editar por diálogo e excluir com confirmação.
class LessonSlotsSection extends StatefulWidget {
  const LessonSlotsSection({super.key, required this.schoolId});

  final String schoolId;

  @override
  State<LessonSlotsSection> createState() => _LessonSlotsSectionState();
}

class _LessonSlotsSectionState extends State<LessonSlotsSection> {
  late final LessonSlotsController _controller = LessonSlotsController(
    inject<ILessonSlotsRepository>(),
    schoolId: widget.schoolId,
  );

  @override
  void initState() {
    super.initState();
    _controller.load();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _openForm([LessonSlot? slot]) async {
    final saved = await LessonSlotFormDialog.show(
      context,
      initial: slot,
      onSubmit: (input) => _controller.save(input, editing: slot),
    );
    if (saved && mounted) {
      showAppToast(context, 'Horário salvo.', type: AppToastType.success);
    }
  }

  Future<void> _remove(LessonSlot slot) async {
    final confirmed = await AppConfirmDialog.show(
      context,
      title: 'Excluir horário',
      message:
          'O horário "${slot.name}" (${slot.timeRange}) será excluído. '
          'Horários usados em aulas não podem ser excluídos.',
      confirmLabel: 'Excluir',
      danger: true,
    );
    if (!confirmed) return;
    final error = await _controller.remove(slot);
    if (!mounted) return;
    showAppToast(
      context,
      error ?? 'Horário excluído.',
      type: error == null ? AppToastType.success : AppToastType.error,
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) => AppSectionCard(
        title: 'Horários das aulas',
        action: AppSecondaryButton(
          label: 'Adicionar horário',
          icon: Icons.add,
          onPressed: _controller.state == ListViewState.loading
              ? null
              : _openForm,
        ),
        child: _body(),
      ),
    );
  }

  Widget _body() {
    switch (_controller.state) {
      case ListViewState.loading:
        return const AppLoadingView();
      case ListViewState.error:
        return AppErrorView(
          message: _controller.error ?? 'Erro ao carregar.',
          onRetry: _controller.load,
        );
      case ListViewState.empty:
        return const AppEmptyView(
          message:
              'Nenhum horário cadastrado. Cadastre os horários para montar o '
              'horário semanal das turmas.',
          icon: Icons.schedule_outlined,
        );
      case ListViewState.ready:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            for (final slot in _controller.slots) ...<Widget>[
              _LessonSlotTile(
                slot: slot,
                onEdit: () => _openForm(slot),
                onRemove: () => _remove(slot),
              ),
              AppDimensions.vGapSm,
            ],
          ],
        );
    }
  }
}

class _LessonSlotTile extends StatelessWidget {
  const _LessonSlotTile({
    required this.slot,
    required this.onEdit,
    required this.onRemove,
  });

  final LessonSlot slot;
  final VoidCallback onEdit;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final styles = context.textStyles;
    return Container(
      padding: AppDimensions.paddingSm,
      decoration: BoxDecoration(
        borderRadius: AppDimensions.borderRadiusSm,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Row(
        children: <Widget>[
          Icon(
            Icons.schedule_outlined,
            size: AppDimensions.iconSizeMd,
            color: colors.textMuted,
          ),
          AppDimensions.hGapMd,
          Expanded(
            child: Text(
              slot.name,
              style: styles.textRegularBold,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Text(
            slot.timeRange,
            style: styles.textRegular.copyWith(color: colors.textSecondary),
          ),
          AppDimensions.hGapSm,
          IconButton(
            tooltip: 'Editar horário',
            icon: Icon(Icons.edit_outlined, color: colors.textSecondary),
            onPressed: onEdit,
          ),
          IconButton(
            tooltip: 'Excluir horário',
            icon: Icon(Icons.delete_outline, color: colors.danger500),
            onPressed: onRemove,
          ),
        ],
      ),
    );
  }
}
