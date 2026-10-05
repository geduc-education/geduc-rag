import '../data/models/schedule_lookups.dart';

/// Argumentos da rota do editor: abre um horário salvo ([scheduleId]) ou
/// cria a semana de [date] para [schoolClass].
class WeeklyScheduleEditorArgs {
  const WeeklyScheduleEditorArgs.edit({
    required String this.scheduleId,
    this.classLabel = '',
    this.schoolId,
  }) : schoolClass = null,
       date = null;

  WeeklyScheduleEditorArgs.create({
    required ScheduleClass this.schoolClass,
    required DateTime this.date,
  }) : scheduleId = null,
       classLabel = schoolClass.label,
       schoolId = schoolClass.schoolId;

  final String? scheduleId;
  final ScheduleClass? schoolClass;

  /// Qualquer dia da semana desejada; o editor normaliza para a segunda.
  final DateTime? date;
  final String classLabel;

  /// Escola da turma (dona dos horários de aula); `null` = o editor busca
  /// pela turma do horário.
  final String? schoolId;
}
