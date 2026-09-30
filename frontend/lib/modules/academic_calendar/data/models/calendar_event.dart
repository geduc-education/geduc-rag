import 'package:intl/intl.dart';

/// Tipo de registro do calendário acadêmico. [code] é o valor trafegado na API.
enum CalendarEventType {
  pontoFacultativo('PONTO_FACULTATIVO', 'Ponto facultativo'),
  diaLetivo('DIA_LETIVO', 'Dia letivo'),
  diaNaoLetivo('DIA_NAO_LETIVO', 'Dia não letivo'),
  planejamentoAula('PLANEJAMENTO_AULA', 'Planejamento de aula'),
  formacaoPedagogica('FORMACAO_PEDAGOGICA', 'Formação pedagógica'),
  evento('EVENTO', 'Evento');

  const CalendarEventType(this.code, this.label);

  final String code;
  final String label;

  /// Tipo do [code]; desconhecido cai em [evento] (tolerante a tipos novos).
  static CalendarEventType fromCode(String? code) => values.firstWhere(
    (t) => t.code == code,
    orElse: () => CalendarEventType.evento,
  );
}

/// Tipos contados nos cards de resumo do mês, na ordem de exibição.
const List<CalendarEventType> calendarSummaryTypes = <CalendarEventType>[
  CalendarEventType.pontoFacultativo,
  CalendarEventType.diaLetivo,
  CalendarEventType.diaNaoLetivo,
  CalendarEventType.planejamentoAula,
  CalendarEventType.formacaoPedagogica,
];

/// Rótulo do escopo de um registro sem escola (vale para a rede toda).
const String calendarNetworkScopeLabel = 'SEMED';

final DateFormat _wireDate = DateFormat('yyyy-MM-dd');

/// Data só-dia no formato da API (`yyyy-MM-dd`).
String formatCalendarWireDate(DateTime date) => _wireDate.format(date);

/// Registro do calendário: um dia marcado para a rede ([schoolId] nulo) ou
/// para uma escola.
class CalendarEvent {
  const CalendarEvent({
    required this.id,
    required this.title,
    required this.type,
    required this.date,
    this.schoolId,
    this.schoolName,
    this.description,
    this.observation,
  });

  factory CalendarEvent.fromJson(Map<String, dynamic> json) => CalendarEvent(
    id: json['id'] as String,
    title: json['title'] as String,
    type: CalendarEventType.fromCode(json['type'] as String?),
    date: _wireDate.parse(json['date'] as String),
    schoolId: json['schoolId'] as String?,
    schoolName: json['schoolName'] as String?,
    description: json['description'] as String?,
    observation: json['observation'] as String?,
  );

  final String id;
  final String title;
  final CalendarEventType type;

  /// Dia do registro (sem hora, no fuso local).
  final DateTime date;
  final String? schoolId;
  final String? schoolName;
  final String? description;
  final String? observation;

  bool get isNetworkWide => schoolId == null;

  /// Nome do escopo: a escola ou [calendarNetworkScopeLabel].
  String get scopeName => schoolName ?? calendarNetworkScopeLabel;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'id': id,
    'title': title,
    'type': type.code,
    'date': formatCalendarWireDate(date),
    'schoolId': schoolId,
    'schoolName': schoolName,
    'description': description,
    'observation': observation,
  };
}

/// Dados de criação/edição de um [CalendarEvent].
class CalendarEventInput {
  const CalendarEventInput({
    required this.title,
    required this.type,
    required this.date,
    this.schoolId,
    this.description,
    this.observation,
  });

  final String title;
  final CalendarEventType type;
  final DateTime date;
  final String? schoolId;
  final String? description;
  final String? observation;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'title': title,
    'type': type.code,
    'date': formatCalendarWireDate(date),
    'schoolId': schoolId,
    'description': description,
    'observation': observation,
  };
}
