import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../shared/components/buttons/app_primary_button.dart';
import '../../../../shared/components/forms/app_date_field.dart';
import '../../../../shared/components/forms/app_dropdown_field.dart';
import '../weekly_schedules_list_controller.dart';

/// Largura dos seletores do filtro.
const double _kFilterWidth = 220;

/// Filtros da listagem (escola → turma e período), atualizar e "Novo
/// horário".
class ScheduleFilterBar extends StatelessWidget {
  const ScheduleFilterBar({
    super.key,
    required this.controller,
    required this.onCreate,
  });

  final WeeklySchedulesListController controller;
  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppDimensions.gapLg,
      runSpacing: AppDimensions.gapMd,
      crossAxisAlignment: WrapCrossAlignment.end,
      children: <Widget>[
        _SchoolClassFilters(controller: controller),
        _PeriodFilters(controller: controller),
        IconButton(
          tooltip: 'Atualizar lista',
          icon: const Icon(Icons.refresh),
          onPressed: controller.load,
        ),
        AppPrimaryButton(
          label: 'Novo horário',
          icon: Icons.add,
          onPressed: onCreate,
        ),
      ],
    );
  }
}

/// Escola → turma; trocar a escola limpa a turma de outra escola.
class _SchoolClassFilters extends StatelessWidget {
  const _SchoolClassFilters({required this.controller});

  final WeeklySchedulesListController controller;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppDimensions.gapLg,
      children: <Widget>[
        SizedBox(
          width: _kFilterWidth,
          child: AppDropdownField<String?>(
            // `initialValue` do form field só relê o valor com chave nova.
            key: ValueKey<String>('school-${controller.schoolId}'),
            label: 'Escola',
            value: controller.schoolId,
            hint: 'Todas',
            options: <AppDropdownOption<String?>>[
              const AppDropdownOption<String?>(value: null, label: 'Todas'),
              for (final s in controller.schools)
                AppDropdownOption<String?>(value: s.id, label: s.name),
            ],
            onChanged: controller.setSchool,
          ),
        ),
        SizedBox(
          width: _kFilterWidth,
          child: AppDropdownField<String?>(
            key: ValueKey<String>(
              'class-${controller.schoolId}-${controller.schoolClassId}',
            ),
            label: 'Turma',
            value: controller.schoolClassId,
            hint: 'Todas',
            options: <AppDropdownOption<String?>>[
              const AppDropdownOption<String?>(value: null, label: 'Todas'),
              for (final c in controller.classOptions)
                AppDropdownOption<String?>(value: c.id, label: c.label),
            ],
            onChanged: controller.setClass,
          ),
        ),
      ],
    );
  }
}

/// Período: semanas que cruzam o intervalo entram na lista.
class _PeriodFilters extends StatelessWidget {
  const _PeriodFilters({required this.controller});

  final WeeklySchedulesListController controller;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppDimensions.gapLg,
      children: <Widget>[
        SizedBox(
          width: _kFilterWidth,
          child: AppDateField(
            label: 'De',
            value: controller.from,
            onChanged: (date) =>
                controller.setPeriod(from: date, to: controller.to),
          ),
        ),
        SizedBox(
          width: _kFilterWidth,
          child: AppDateField(
            label: 'Até',
            value: controller.to,
            onChanged: (date) =>
                controller.setPeriod(from: controller.from, to: date),
          ),
        ),
      ],
    );
  }
}
