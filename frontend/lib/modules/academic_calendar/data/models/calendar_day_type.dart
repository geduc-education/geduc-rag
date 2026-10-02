import 'package:intl/intl.dart';

/// Tipo de um dia do calendário acadêmico. [code] é o valor trafegado na API
/// (`DAY_TYPES` do backend); [label] é o rótulo exibido.
enum CalendarDayType {
  schoolDay('SCHOOL_DAY', 'Dia letivo'),
  nonSchoolDay('NON_SCHOOL_DAY', 'Dia não letivo'),
  optionalDay('OPTIONAL_DAY', 'Ponto facultativo'),
  lessonPlanning('LESSON_PLANNING', 'Planejamento de aula'),
  teacherTraining('TEACHER_TRAINING', 'Formação pedagógica');

  const CalendarDayType(this.code, this.label);

  final String code;
  final String label;

  /// Tipo do [code], ou `null` se desconhecido.
  static CalendarDayType? fromCode(Object? code) {
    for (final type in values) {
      if (type.code == code) return type;
    }
    return null;
  }
}

/// Visão do calendário (`view` da API). Semana = domingo a sábado.
enum CalendarView {
  day('day', 'Dia'),
  week('week', 'Semana'),
  month('month', 'Mês'),
  year('year', 'Ano');

  const CalendarView(this.code, this.label);

  final String code;
  final String label;

  static CalendarView fromCode(Object? code) => values.firstWhere(
    (v) => v.code == code,
    orElse: () => CalendarView.month,
  );
}

final DateFormat _wireDate = DateFormat('yyyy-MM-dd');

/// Data só-dia no formato da API (`yyyy-MM-dd`).
String formatCalendarWireDate(DateTime date) => _wireDate.format(date);

/// Lê uma data `yyyy-MM-dd` como meia-noite local; `null` se inválida.
DateTime? parseCalendarWireDate(Object? raw) {
  if (raw is! String || raw.length < 10) return null;
  try {
    return _wireDate.parseStrict(raw.substring(0, 10));
  } on FormatException {
    return null;
  }
}

/// Mesmo dia do calendário, ignorando a hora.
bool isSameCalendarDay(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;
