import 'package:flutter/material.dart';
import 'package:flutter_modular/flutter_modular.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../shared/components/buttons/app_primary_button.dart';
import '../../../shared/components/buttons/app_secondary_button.dart';
import '../../../shared/components/feedback/app_error_banner.dart';
import '../../../shared/components/feedback/app_inline_notice.dart';
import '../../../shared/components/feedback/app_toast.dart';
import '../../../shared/components/forms/app_switch_row.dart';
import '../../../shared/components/forms/app_text_field.dart';
import '../../../shared/utils/validators.dart';
import '../data/models/school_model.dart';
import '../data/schools_repository.dart';
import 'school_form_controller.dart';
import 'widgets/lesson_slots_section.dart';

/// Rota da listagem, destino ao salvar/cancelar.
const String _listRoute = '/home/schools/';

/// Formulário de criar/editar escola do tenant ativo.
class SchoolFormPage extends StatefulWidget {
  const SchoolFormPage({super.key, this.school});

  final SchoolModel? school;

  @override
  State<SchoolFormPage> createState() => _SchoolFormPageState();
}

class _SchoolFormPageState extends State<SchoolFormPage> {
  late final SchoolFormController _controller;
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;

  @override
  void initState() {
    super.initState();
    _controller = SchoolFormController(
      inject<ISchoolsRepository>(),
      editing: widget.school,
    );
    _name = TextEditingController(text: widget.school?.name ?? '');
  }

  @override
  void dispose() {
    _name.dispose();
    _controller.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final creating = !_controller.isEditing;
    final ok = await _controller.save(name: _name.text);
    if (!ok || !mounted) return;
    if (creating) {
      // Fica na tela, já em edição: a seção de horários precisa do id.
      showAppToast(
        context,
        'Escola criada. Cadastre agora os horários das aulas.',
        type: AppToastType.success,
      );
      return;
    }
    // Volta para a lista (que recarrega ao montar) — `pop` quebra o
    // RouterOutlet do shell (mesmo motivo do `EmployeeFormPage`).
    context.navigate(_listRoute);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: AnimatedBuilder(
          animation: _controller,
          builder: (context, _) =>
              Text(_controller.isEditing ? 'Editar escola' : 'Nova escola'),
        ),
      ),
      body: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) => SingleChildScrollView(
          padding: AppDimensions.paddingXl,
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  Form(key: _formKey, child: _buildFields()),
                  AppDimensions.vGapXxl,
                  _SlotsArea(schoolId: _controller.editing?.id),
                ],
              ),
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
          hint: 'Ex.: EMEF Monteiro Lobato',
          controller: _name,
          enabled: !saving,
          validator: _validateName,
        ),
        AppDimensions.vGapLg,
        AppSwitchRow(
          label: 'Ativa',
          description: 'Escolas inativas continuam no cadastro.',
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

/// Horários das aulas: só com a escola salva (precisam do id).
class _SlotsArea extends StatelessWidget {
  const _SlotsArea({required this.schoolId});

  final String? schoolId;

  @override
  Widget build(BuildContext context) {
    final id = schoolId;
    if (id != null) return LessonSlotsSection(key: ValueKey(id), schoolId: id);
    return const AppInlineNotice(
      icon: Icons.schedule_outlined,
      message: 'Salve a escola para cadastrar os horários das aulas.',
    );
  }
}
