import 'package:flutter/material.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../utils/list_filters.dart';
import '../buttons/app_primary_button.dart';
import '../forms/app_dropdown_field.dart';
import '../forms/app_text_field.dart';

/// Barra das listagens de cadastro: busca, filtros extras ([filters]),
/// filtro de status, atualizar e "Adicionar" (oculto com [onCreate] `null`).
class AppListToolbar extends StatelessWidget {
  const AppListToolbar({
    super.key,
    required this.searchController,
    required this.searchHint,
    required this.status,
    required this.onSearch,
    required this.onStatus,
    required this.onRefresh,
    this.onCreate,
    this.createIcon = Icons.add,
    this.filters = const <Widget>[],
  });

  final TextEditingController searchController;
  final String searchHint;
  final ActiveFilter status;
  final ValueChanged<String> onSearch;
  final ValueChanged<ActiveFilter> onStatus;
  final VoidCallback onRefresh;
  final VoidCallback? onCreate;
  final IconData createIcon;

  /// Filtros adicionais exibidos entre a busca e o status.
  final List<Widget> filters;

  static const double _statusWidth = 180;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: <Widget>[
        Expanded(
          child: AppTextField(
            label: 'Buscar',
            hint: searchHint,
            controller: searchController,
            prefixIcon: Icons.search,
            onSubmitted: onSearch,
          ),
        ),
        for (final filter in filters) ...<Widget>[AppDimensions.hGapLg, filter],
        AppDimensions.hGapLg,
        SizedBox(
          width: _statusWidth,
          child: AppDropdownField<ActiveFilter>(
            label: 'Status',
            value: status,
            options: <AppDropdownOption<ActiveFilter>>[
              for (final option in ActiveFilter.values)
                AppDropdownOption(value: option, label: option.label),
            ],
            onChanged: (value) {
              if (value != null) onStatus(value);
            },
          ),
        ),
        AppDimensions.hGapSm,
        IconButton(
          tooltip: 'Atualizar lista',
          icon: const Icon(Icons.refresh),
          onPressed: onRefresh,
        ),
        if (onCreate != null) ...<Widget>[
          AppDimensions.hGapLg,
          AppPrimaryButton(
            label: 'Adicionar',
            icon: createIcon,
            onPressed: onCreate,
          ),
        ],
      ],
    );
  }
}
