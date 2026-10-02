import 'calendar_day_type.dart';
import 'day_type_totals.dart';

/// Calendário acadêmico (ano letivo) do tenant — espelha o
/// `AcademicCalendarResponseDto`. [totals] só vem no detalhe, na criação e na
/// edição. Serialização manual.
class AcademicCalendar {
  const AcademicCalendar({
    required this.id,
    required this.year,
    required this.name,
    required this.startDate,
    required this.endDate,
    this.tenantId = '',
    this.allSchools = true,
    this.schoolIds = const <String>[],
    this.createdAt,
    this.updatedAt,
    this.totals,
  });

  final String id;
  final String tenantId;
  final int year;
  final String name;

  /// Primeiro e último dia do período (meia-noite local).
  final DateTime startDate;
  final DateTime endDate;

  /// Vale para todas as escolas do tenant; senão, só para [schoolIds].
  final bool allSchools;
  final List<String> schoolIds;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final DayTypeTotals? totals;

  /// [date] está dentro do período do calendário.
  bool contains(DateTime date) {
    final day = DateTime(date.year, date.month, date.day);
    return !day.isBefore(startDate) && !day.isAfter(endDate);
  }

  factory AcademicCalendar.fromJson(Map<String, dynamic> json) {
    final year = (json['year'] as num?)?.toInt() ?? DateTime.now().year;
    final rawSchools = json['schoolIds'];
    final rawTotals = json['totals'];
    return AcademicCalendar(
      id: json['id']?.toString() ?? '',
      tenantId: json['tenantId']?.toString() ?? '',
      year: year,
      name: json['name']?.toString() ?? '',
      startDate: parseCalendarWireDate(json['startDate']) ?? DateTime(year),
      endDate: parseCalendarWireDate(json['endDate']) ?? DateTime(year, 12, 31),
      allSchools: json['allSchools'] != false,
      schoolIds: rawSchools is List
          ? rawSchools.map((e) => e.toString()).toList(growable: false)
          : const <String>[],
      createdAt: _timestamp(json['createdAt']),
      updatedAt: _timestamp(json['updatedAt']),
      totals: rawTotals is Map<String, dynamic>
          ? DayTypeTotals.fromJson(rawTotals)
          : null,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'id': id,
    'tenantId': tenantId,
    'year': year,
    'name': name,
    'startDate': formatCalendarWireDate(startDate),
    'endDate': formatCalendarWireDate(endDate),
    'allSchools': allSchools,
    'schoolIds': schoolIds,
    'createdAt': ?createdAt?.toIso8601String(),
    'updatedAt': ?updatedAt?.toIso8601String(),
    'totals': ?totals?.toJson(),
  };

  static DateTime? _timestamp(Object? raw) =>
      raw == null ? null : DateTime.tryParse(raw.toString());
}

/// Página da listagem (`{ data, total }`).
class AcademicCalendarsPage {
  const AcademicCalendarsPage({required this.items, required this.total});

  final List<AcademicCalendar> items;
  final int total;

  factory AcademicCalendarsPage.fromJson(Map<String, dynamic> json) {
    final raw = json['data'];
    return AcademicCalendarsPage(
      items: raw is List
          ? raw
                .whereType<Map<String, dynamic>>()
                .map(AcademicCalendar.fromJson)
                .toList(growable: false)
          : const <AcademicCalendar>[],
      total: (json['total'] as num?)?.toInt() ?? 0,
    );
  }
}

/// Payload de `POST /academic-calendars`. O tenant vem do header.
class CreateAcademicCalendarInput {
  const CreateAcademicCalendarInput({
    required this.year,
    required this.name,
    required this.startDate,
    required this.endDate,
    required this.allSchools,
    this.schoolIds = const <String>[],
  });

  final int year;
  final String name;
  final DateTime startDate;
  final DateTime endDate;
  final bool allSchools;
  final List<String> schoolIds;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'year': year,
    'name': name.trim(),
    'startDate': formatCalendarWireDate(startDate),
    'endDate': formatCalendarWireDate(endDate),
    'allSchools': allSchools,
    if (!allSchools) 'schoolIds': schoolIds,
  };
}

/// Payload de `PATCH /academic-calendars/:id`: só nome e escolas mudam.
/// Campo `null` não é enviado.
class UpdateAcademicCalendarInput {
  const UpdateAcademicCalendarInput({
    this.name,
    this.allSchools,
    this.schoolIds,
  });

  final String? name;
  final bool? allSchools;
  final List<String>? schoolIds;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'name': ?name?.trim(),
    'allSchools': ?allSchools,
    if (allSchools != true) 'schoolIds': ?schoolIds,
  };
}
