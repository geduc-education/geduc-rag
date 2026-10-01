import 'package:flutter/material.dart';

import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/colors_app.dart';
import '../../../../shared/components/feedback/app_status_badge.dart';
import '../../../../shared/components/user/app_avatar_initials.dart';
import '../../data/models/employee_model.dart';

/// Item da listagem de funcionários. Editar/excluir só com [canManage];
/// "Excluir definitivamente" só com [canPurge].
class EmployeeTile extends StatelessWidget {
  const EmployeeTile({
    super.key,
    required this.employee,
    required this.canManage,
    required this.canPurge,
    required this.onEdit,
    required this.onRemove,
    required this.onPurge,
  });

  final EmployeeModel employee;
  final bool canManage;
  final bool canPurge;
  final VoidCallback onEdit;
  final VoidCallback onRemove;
  final VoidCallback onPurge;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: AppDimensions.paddingLg,
      decoration: BoxDecoration(
        color: colors.surfaceCard,
        borderRadius: AppDimensions.borderRadius,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Row(
        children: <Widget>[
          AppAvatarInitials(name: employee.name),
          AppDimensions.hGapMd,
          Expanded(child: _EmployeeInfo(employee: employee)),
          if (canManage) ...<Widget>[
            IconButton(
              tooltip: 'Editar',
              icon: Icon(Icons.edit_outlined, color: colors.textSecondary),
              onPressed: onEdit,
            ),
            IconButton(
              tooltip: 'Excluir',
              icon: Icon(Icons.delete_outline, color: colors.danger500),
              onPressed: onRemove,
            ),
          ],
          if (canPurge)
            IconButton(
              tooltip: 'Excluir definitivamente',
              icon: Icon(
                Icons.delete_forever_outlined,
                color: colors.danger700,
              ),
              onPressed: onPurge,
            ),
        ],
      ),
    );
  }
}

class _EmployeeInfo extends StatelessWidget {
  const _EmployeeInfo({required this.employee});

  final EmployeeModel employee;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final muted = context.textStyles.textSmall.copyWith(
      color: colors.textMuted,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            Flexible(
              child: Text(
                employee.name,
                style: context.textStyles.textRegularBold.copyWith(
                  color: colors.textPrimary,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            AppDimensions.hGapSm,
            AppStatusBadge(active: employee.active),
          ],
        ),
        Text(
          '${employee.email} · CPF ${employee.formattedDocument}',
          style: context.textStyles.textSmall,
          overflow: TextOverflow.ellipsis,
        ),
        Text(employee.positionLabel, style: muted),
      ],
    );
  }
}
