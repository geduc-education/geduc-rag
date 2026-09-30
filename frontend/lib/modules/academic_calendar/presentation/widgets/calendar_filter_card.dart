import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../shared/components/buttons/app_primary_button.dart';
import '../../../../shared/components/buttons/app_secondary_button.dart';
import '../../../../shared/components/forms/app_dropdown_field.dart';
import '../../../../shared/components/responsive/breakpoints.dart';
import '../../data/models/calendar_event.dart';
import '../academic_calendar_controller.dart';
import 'calendar_panel.dart';

/// Card "Filtrar datas": escola, tipo de registro e as ações Buscar e
/// Registrar datas.
class CalendarFilterCard extends StatelessWidget {
  const CalendarFilterCard({
    super.key,
    required this.controller,
    required this.onRegister,
  });

  final AcademicCalendarController controller;
  final VoidCallback onRegister;

  @override
  Widget build(BuildContext context) {
    return CalendarPanel(
      title: 'Filtrar datas',
      padding: AppDimensions.paddingXl,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          _FilterFields(controller: controller),
          AppDimensions.vGapLg,
          Wrap(
            spacing: AppDimensions.gapSm,
            runSpacing: AppDimensions.gapSm,
            children: <Widget>[
              AppSecondaryButton(
                label: 'Buscar',
                icon: Icons.search,
                onPressed: controller.search,
              ),
              AppPrimaryButton(
                label: 'Registrar datas',
                icon: Icons.add_circle_outline,
                onPressed: onRegister,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FilterFields extends StatelessWidget {
  const _FilterFields({required this.controller});

  final AcademicCalendarController controller;

  @override
  Widget build(BuildContext context) {
    final school = AppDropdownField<String?>(
      label: 'Escola',
      hint: 'Todas as escolas',
      loading: !controller.schoolsLoaded,
      value: controller.schoolId,
      options: <AppDropdownOption<String?>>[
        const AppDropdownOption<String?>(
          value: null,
          label: 'Todas as escolas',
        ),
        for (final s in controller.schools)
          AppDropdownOption<String?>(value: s.id, label: s.name),
      ],
      onChanged: controller.selectSchool,
    );
    final type = AppDropdownField<CalendarEventType?>(
      label: 'Tipo de registro',
      hint: 'Todos os tipos',
      value: controller.type,
      options: <AppDropdownOption<CalendarEventType?>>[
        const AppDropdownOption<CalendarEventType?>(
          value: null,
          label: 'Todos os tipos',
        ),
        for (final t in CalendarEventType.values)
          AppDropdownOption<CalendarEventType?>(value: t, label: t.label),
      ],
      onChanged: controller.selectType,
    );
    return LayoutBuilder(
      builder: (context, constraints) {
        if (AppBreakpoints.fromConstraints(constraints).isMobile) {
          return Column(children: <Widget>[school, AppDimensions.vGapLg, type]);
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Expanded(child: school),
            AppDimensions.hGapXl,
            Expanded(child: type),
          ],
        );
      },
    );
  }
}
