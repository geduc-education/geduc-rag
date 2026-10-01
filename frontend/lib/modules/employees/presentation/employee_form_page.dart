import 'package:flutter/material.dart';
import 'package:flutter_modular/flutter_modular.dart';

import '../../../core/auth/app_permissions.dart';
import '../../../core/auth/permission_service.dart';
import '../../../core/tenancy/tenant_context.dart';
import '../../../core/theme/app_dimensions.dart';
import '../../../shared/components/buttons/app_primary_button.dart';
import '../../../shared/components/buttons/app_secondary_button.dart';
import '../../../shared/components/feedback/app_error_banner.dart';
import '../../../shared/components/forms/app_cpf_field.dart';
import '../../../shared/components/forms/app_switch_row.dart';
import '../../../shared/components/forms/app_text_field.dart';
import '../../../shared/utils/cpf.dart';
import '../../../shared/utils/validators.dart';
import '../data/employees_repository.dart';
import '../data/models/employee_model.dart';
import 'employee_form_controller.dart';
import 'widgets/linked_user_field.dart';

/// Rota da listagem, destino ao salvar/cancelar.
const String _listRoute = '/home/employees/';

/// Formulário de criar/editar funcionário do tenant ativo.
class EmployeeFormPage extends StatefulWidget {
  const EmployeeFormPage({super.key, this.employee});

  final EmployeeModel? employee;

  @override
  State<EmployeeFormPage> createState() => _EmployeeFormPageState();
}

class _EmployeeFormPageState extends State<EmployeeFormPage> {
  late final EmployeeFormController _controller;
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _email;
  late final TextEditingController _document;
  late final TextEditingController _position;

  @override
  void initState() {
    super.initState();
    final employee = widget.employee;
    _controller = EmployeeFormController(
      inject<IEmployeesRepository>(),
      editing: employee,
      canLinkUser: inject<PermissionService>().canAny(const <String>[
        AppPermissions.userRead,
        AppPermissions.userManage,
      ]),
      tenantId: inject<TenantContext>().activeTenantId,
    );
    _name = TextEditingController(text: employee?.name ?? '');
    _email = TextEditingController(text: employee?.email ?? '');
    _document = TextEditingController(text: Cpf.format(employee?.document));
    _position = TextEditingController(text: employee?.position ?? '');
    _controller.bootstrap();
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _document.dispose();
    _position.dispose();
    _controller.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final ok = await _controller.save(
      name: _name.text,
      email: _email.text,
      document: _document.text,
      position: _position.text,
    );
    // Volta para a lista (que recarrega ao montar) — mesmo motivo do
    // `UserFormPage`: `pop` quebra o RouterOutlet do shell.
    if (ok && mounted) context.navigate(_listRoute);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          _controller.isEditing ? 'Editar funcionário' : 'Novo funcionário',
        ),
      ),
      body: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) => SingleChildScrollView(
          padding: AppDimensions.paddingXl,
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: Form(key: _formKey, child: _buildFields()),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFields() {
    final saving = _controller.saving;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        AppErrorBanner(message: _controller.error),
        if (_controller.error != null) AppDimensions.vGapLg,
        AppTextField(
          label: 'Nome',
          controller: _name,
          enabled: !saving,
          validator: _validateName,
        ),
        AppDimensions.vGapLg,
        AppTextField(
          label: 'E-mail',
          controller: _email,
          enabled: !saving,
          keyboardType: TextInputType.emailAddress,
          validator: Validators.email,
        ),
        AppDimensions.vGapLg,
        AppCpfField(controller: _document, enabled: !saving),
        AppDimensions.vGapLg,
        AppTextField(
          label: 'Cargo (opcional)',
          controller: _position,
          enabled: !saving,
          validator: (v) => _maxLength(v, 120, 'O cargo'),
        ),
        if (_controller.canLinkUser) ...<Widget>[
          AppDimensions.vGapLg,
          LinkedUserField(controller: _controller, enabled: !saving),
        ],
        AppDimensions.vGapLg,
        AppSwitchRow(
          label: 'Ativo',
          description: 'Funcionários inativos continuam no cadastro.',
          value: _controller.active,
          enabled: !saving,
          onChanged: _controller.setActive,
        ),
        AppDimensions.vGapXxl,
        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: <Widget>[
            AppSecondaryButton(
              label: 'Cancelar',
              onPressed: saving ? null : () => context.navigate(_listRoute),
            ),
            AppDimensions.hGapSm,
            AppPrimaryButton(
              label: 'Salvar',
              loading: saving,
              onPressed: _save,
            ),
          ],
        ),
      ],
    );
  }

  static String? _validateName(String? value) {
    final base = Validators.required(value, field: 'Nome');
    if (base != null) return base;
    if (value!.trim().length < 2) {
      return 'O nome deve ter ao menos 2 caracteres.';
    }
    return _maxLength(value, 120, 'O nome');
  }

  static String? _maxLength(String? value, int max, String field) =>
      (value?.trim().length ?? 0) > max
      ? '$field deve ter no máximo $max caracteres.'
      : null;
}
