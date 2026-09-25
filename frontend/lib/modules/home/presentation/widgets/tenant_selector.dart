import 'package:flutter/material.dart';

import '../../../../core/tenancy/tenant_context.dart';
import '../../../../core/theme/app_dimensions.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/colors_app.dart';

/// Seletor do tenant ativo no header do shell. O tenant escolhido vai no
/// header `tenant-id` das rotas do RAG. Com um único vínculo vira só um
/// rótulo; sem vínculo, um aviso discreto.
class TenantSelector extends StatelessWidget {
  const TenantSelector({super.key, required this.tenants});

  final TenantContext tenants;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: tenants,
      builder: (context, _) {
        final available = tenants.available;
        if (available.isEmpty) {
          return const _TenantLabel(
            icon: Icons.domain_disabled_outlined,
            label: 'Sem tenant',
          );
        }
        final label = tenants.activeTenant?.name ?? available.first.name;
        if (available.length == 1) {
          return _TenantLabel(icon: Icons.domain_outlined, label: label);
        }
        return PopupMenuButton<String>(
          tooltip: 'Trocar tenant',
          onSelected: tenants.select,
          itemBuilder: (_) => <PopupMenuEntry<String>>[
            for (final tenant in available)
              CheckedPopupMenuItem<String>(
                value: tenant.id,
                checked: tenant.id == tenants.activeTenantId,
                child: Text(tenant.name),
              ),
          ],
          child: _TenantLabel(
            icon: Icons.domain_outlined,
            label: label,
            trailing: Icons.expand_more_rounded,
          ),
        );
      },
    );
  }
}

class _TenantLabel extends StatelessWidget {
  const _TenantLabel({required this.icon, required this.label, this.trailing});

  final IconData icon;
  final String label;
  final IconData? trailing;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppDimensions.gapSm),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(icon, size: 18, color: colors.textSecondary),
          AppDimensions.hGapXs,
          Text(label, style: context.textStyles.textSmall),
          if (trailing != null)
            Icon(trailing, size: 18, color: colors.textMuted),
        ],
      ),
    );
  }
}
