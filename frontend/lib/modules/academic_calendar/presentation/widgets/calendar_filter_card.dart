import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../shared/components/buttons/app_primary_button.dart';
import '../../../../shared/components/forms/app_dropdown_field.dart';
import '../../../../shared/components/responsive/breakpoints.dart';
import '../academic_calendars_list_controller.dart';
import 'calendar_panel.dart';

/// Card "Calendários": filtros por ano e escola e a ação "Novo calendário".
/// Os filtros aplicam na hora (recarregam a lista).
class CalendarFilterCard extends StatelessWidget {
  const CalendarFilterCard({
    super.key,
    required this.controller,
    required this.onCreate,
    required this.child,
  });

  final AcademicCalendarsListController controller;
  final VoidCallback onCreate;

  /// Lista de calendários, abaixo dos filtros.
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return CalendarPanel(
      title: 'Calendários',
      padding: AppDimensions.paddingXl,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          _FilterFields(controller: controller),
          AppDimensions.vGapLg,
          Align(
            alignment: Alignment.centerLeft,
            child: AppPrimaryButton(
              label: 'Novo calendário',
              icon: Icons.add_circle_outline,
              onPressed: onCreate,
            ),
          ),
          AppDimensions.vGapXl,
          child,
        ],
      ),
    );
  }
}

class _FilterFields extends StatelessWidget {
  const _FilterFields({required this.controller});

  final AcademicCalendarsListController controller;

  @override
  Widget build(BuildContext context) {
    final year = _YearFilter(controller: controller);
    final school = _SchoolFilter(controller: controller);
    return LayoutBuilder(
      builder: (context, constraints) {
        if (AppBreakpoints.fromConstraints(constraints).isMobile) {
          return Column(children: <Widget>[year, AppDimensions.vGapLg, school]);
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Expanded(child: year),
            AppDimensions.hGapXl,
            Expanded(child: school),
          ],
        );
      },
    );
  }
}

class _YearFilter extends StatelessWidget {
  const _YearFilter({required this.controller});

  final AcademicCalendarsListController controller;

  @override
  Widget build(BuildContext context) {
    return AppDropdownField<int?>(
      label: 'Ano letivo',
      hint: 'Todos os anos',
      value: controller.year,
      options: <AppDropdownOption<int?>>[
        const AppDropdownOption<int?>(value: null, label: 'Todos os anos'),
        for (final y in controller.yearOptions)
          AppDropdownOption<int?>(value: y, label: '$y'),
      ],
      onChanged: controller.setYear,
    );
  }
}

class _SchoolFilter extends StatelessWidget {
  const _SchoolFilter({required this.controller});

  final AcademicCalendarsListController controller;

  @override
  Widget build(BuildContext context) {
    return AppDropdownField<String?>(
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
          AppDropdownOption<String?>(value: s.id, label: s.label),
      ],
      onChanged: controller.setSchool,
    );
  }
}
