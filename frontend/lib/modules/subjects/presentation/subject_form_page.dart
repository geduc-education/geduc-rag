import 'package:flutter/material.dart';
import 'package:flutter_modular/flutter_modular.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../shared/components/buttons/app_primary_button.dart';
import '../../../shared/components/buttons/app_secondary_button.dart';
import '../../../shared/components/feedback/app_error_banner.dart';
import '../../../shared/components/forms/app_switch_row.dart';
import '../../../shared/components/forms/app_text_field.dart';
import '../../../shared/utils/validators.dart';
import '../data/models/subject_model.dart';
import '../data/subjects_repository.dart';
import 'subject_form_controller.dart';

/// Rota da listagem, destino ao salvar/cancelar.
const String _listRoute = '/home/subjects/';

/// Formulário de criar/editar disciplina do tenant ativo.
class SubjectFormPage extends StatefulWidget {
  const SubjectFormPage({super.key, this.subject});

  final SubjectModel? subject;

  @override
  State<SubjectFormPage> createState() => _SubjectFormPageState();
}

class _SubjectFormPageState extends State<SubjectFormPage> {
  late final SubjectFormController _controller;
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;

  @override
  void initState() {
    super.initState();
    _controller = SubjectFormController(
      inject<ISubjectsRepository>(),
      editing: widget.subject,
    );
    _name = TextEditingController(text: widget.subject?.name ?? '');
  }

  @override
  void dispose() {
    _name.dispose();
    _controller.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final ok = await _controller.save(name: _name.text);
    // Volta para a lista (que recarrega ao montar) — `pop` quebra o
    // RouterOutlet do shell (mesmo motivo do `EmployeeFormPage`).
    if (ok && mounted) context.navigate(_listRoute);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          _controller.isEditing ? 'Editar disciplina' : 'Nova disciplina',
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
          hint: 'Ex.: Matemática',
          controller: _name,
          enabled: !saving,
          validator: _validateName,
        ),
        AppDimensions.vGapLg,
        AppSwitchRow(
          label: 'Ativa',
          description: 'Disciplinas inativas continuam no cadastro.',
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
    final length = value!.trim().length;
    if (length < 2) return 'O nome deve ter ao menos 2 caracteres.';
    if (length > 191) return 'O nome deve ter no máximo 191 caracteres.';
    return null;
  }
}
