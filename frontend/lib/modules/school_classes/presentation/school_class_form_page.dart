import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_modular/flutter_modular.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../shared/components/buttons/app_primary_button.dart';
import '../../../shared/components/buttons/app_secondary_button.dart';
import '../../../shared/components/feedback/app_error_banner.dart';
import '../../../shared/components/forms/app_read_only_field.dart';
import '../../../shared/components/forms/app_switch_row.dart';
import '../../../shared/components/forms/app_text_field.dart';
import '../../../shared/utils/validators.dart';
import '../data/models/school_class_model.dart';
import '../data/school_classes_repository.dart';
import 'school_class_form_controller.dart';
import 'widgets/school_select_field.dart';

/// Rota da listagem, destino ao salvar/cancelar.
const String _listRoute = '/home/school-classes/';

/// Faixa de ano letivo aceita pelo backend.
const int _minYear = 2000;
const int _maxYear = 2100;

/// Formulário de criar/editar turma. Escola e ano letivo só são editáveis na
/// criação; na edição aparecem como leitura.
class SchoolClassFormPage extends StatefulWidget {
  const SchoolClassFormPage({super.key, this.schoolClass});

  final SchoolClassModel? schoolClass;

  @override
  State<SchoolClassFormPage> createState() => _SchoolClassFormPageState();
}

class _SchoolClassFormPageState extends State<SchoolClassFormPage> {
  late final SchoolClassFormController _controller;
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _year;

  @override
  void initState() {
    super.initState();
    final editing = widget.schoolClass;
    _controller = SchoolClassFormController(
      inject<ISchoolClassesRepository>(),
      editing: editing,
    );
    _name = TextEditingController(text: editing?.name ?? '');
    _year = TextEditingController(
      text: '${editing?.schoolYear ?? DateTime.now().year}',
    );
    _controller.bootstrap();
  }

  @override
  void dispose() {
    _name.dispose();
    _year.dispose();
    _controller.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final ok = await _controller.save(
      name: _name.text,
      schoolYear: int.tryParse(_year.text.trim()) ?? 0,
    );
    // Volta para a lista (que recarrega ao montar) — `pop` quebra o
    // RouterOutlet do shell (mesmo motivo do `EmployeeFormPage`).
    if (ok && mounted) context.navigate(_listRoute);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_controller.isEditing ? 'Editar turma' : 'Nova turma'),
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
        ..._buildImmutableFields(saving),
        AppDimensions.vGapLg,
        AppTextField(
          label: 'Nome',
          hint: 'Ex.: 8º A',
          controller: _name,
          enabled: !saving,
          validator: _validateName,
        ),
        AppDimensions.vGapLg,
        AppSwitchRow(
          label: 'Ativa',
          description: 'Turmas inativas continuam no cadastro.',
          value: _controller.active,
          enabled: !saving,
          onChanged: _controller.setActive,
        ),
        AppDimensions.vGapXxl,
        _buildActions(saving),
      ],
    );
  }

  Widget _buildActions(bool saving) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: <Widget>[
        AppSecondaryButton(
          label: 'Cancelar',
          onPressed: saving ? null : () => context.navigate(_listRoute),
        ),
        AppDimensions.hGapSm,
        AppPrimaryButton(label: 'Salvar', loading: saving, onPressed: _save),
      ],
    );
  }

  /// Escola e ano letivo: editáveis na criação, só leitura na edição.
  List<Widget> _buildImmutableFields(bool saving) {
    final editing = widget.schoolClass;
    if (editing != null) {
      return <Widget>[
        AppReadOnlyField(
          label: 'Escola',
          value: editing.schoolName,
          icon: Icons.school_outlined,
        ),
        AppDimensions.vGapLg,
        AppReadOnlyField(label: 'Ano letivo', value: '${editing.schoolYear}'),
      ];
    }
    return <Widget>[
      SchoolSelectField(
        label: 'Escola',
        schools: _controller.schools,
        value: _controller.schoolId,
        loading: _controller.loadingSchools,
        enabled: !saving,
        onChanged: _controller.selectSchool,
        validator: (v) =>
            (v == null || v.isEmpty) ? 'Selecione a escola.' : null,
      ),
      AppDimensions.vGapLg,
      AppTextField(
        label: 'Ano letivo',
        controller: _year,
        enabled: !saving,
        keyboardType: TextInputType.number,
        inputFormatters: <TextInputFormatter>[
          FilteringTextInputFormatter.digitsOnly,
          LengthLimitingTextInputFormatter(4),
        ],
        validator: _validateYear,
      ),
    ];
  }

  static String? _validateName(String? value) {
    final base = Validators.required(value, field: 'Nome');
    if (base != null) return base;
    if (value!.trim().length > 191) {
      return 'O nome deve ter no máximo 191 caracteres.';
    }
    return null;
  }

  static String? _validateYear(String? value) {
    final year = int.tryParse(value?.trim() ?? '');
    if (year == null || year < _minYear || year > _maxYear) {
      return 'Informe um ano entre $_minYear e $_maxYear.';
    }
    return null;
  }
}
