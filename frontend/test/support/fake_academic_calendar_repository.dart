import 'package:geduc_rag/core/errors/app_exception.dart';
import 'package:geduc_rag/modules/academic_calendar/data/academic_calendar_repository.dart';
import 'package:geduc_rag/modules/academic_calendar/data/models/academic_calendar.dart';
import 'package:geduc_rag/modules/academic_calendar/data/models/calendar_day.dart';
import 'package:geduc_rag/modules/academic_calendar/data/models/calendar_day_type.dart';
import 'package:geduc_rag/modules/academic_calendar/data/models/calendar_school.dart';
import 'package:geduc_rag/modules/academic_calendar/data/models/day_type_totals.dart';

/// Repositório fake do calendário: registra as chamadas, devolve os dados
/// configurados e gera os dias como o backend (fim de semana não letivo).
class FakeAcademicCalendarRepository implements IAcademicCalendarRepository {
  FakeAcademicCalendarRepository({
    this.calendars = const <AcademicCalendar>[],
    this.schools = const <CalendarSchool>[],
    this.failWith,
  });

  List<AcademicCalendar> calendars;
  List<CalendarSchool> schools;
  AppException? failWith;

  final List<String> calls = <String>[];
  final Map<DateTime, CalendarDay> _edited = <DateTime, CalendarDay>{};
  ({int? year, String? schoolId})? lastList;
  ({CalendarView view, DateTime date})? lastDays;
  CreateAcademicCalendarInput? created;
  UpdateAcademicCalendarInput? updated;
  CalendarDayUpdate? dayUpdate;
  String? removedId;

  void _maybeFail() {
    final error = failWith;
    if (error != null) throw error;
  }

  @override
  Future<List<CalendarSchool>> listSchools() async {
    calls.add('listSchools');
    _maybeFail();
    return schools;
  }

  @override
  Future<AcademicCalendarsPage> list({
    int? year,
    String? schoolId,
    int page = 1,
    int limit = 100,
  }) async {
    calls.add('list');
    lastList = (year: year, schoolId: schoolId);
    _maybeFail();
    final items = calendars.where((c) => year == null || c.year == year);
    return AcademicCalendarsPage(items: items.toList(), total: items.length);
  }

  @override
  Future<AcademicCalendar> getById(String id) async {
    calls.add('getById');
    _maybeFail();
    return calendars.firstWhere((c) => c.id == id);
  }

  @override
  Future<AcademicCalendar> create(CreateAcademicCalendarInput input) async {
    calls.add('create');
    _maybeFail();
    created = input;
    return AcademicCalendar(
      id: 'new',
      year: input.year,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      allSchools: input.allSchools,
      schoolIds: input.schoolIds,
    );
  }

  @override
  Future<AcademicCalendar> update(
    String id,
    UpdateAcademicCalendarInput input,
  ) async {
    calls.add('update');
    _maybeFail();
    updated = input;
    return calendars.firstWhere((c) => c.id == id);
  }

  @override
  Future<void> remove(String id) async {
    calls.add('remove');
    _maybeFail();
    removedId = id;
  }

  @override
  Future<CalendarDaysPeriod> listDays(
    String id, {
    required CalendarView view,
    required DateTime date,
  }) async {
    calls.add('listDays');
    lastDays = (view: view, date: date);
    _maybeFail();
    final calendar = calendars.firstWhere((c) => c.id == id);
    final (start, end) = _period(view, date);
    final days = <CalendarDay>[
      for (
        var d = start;
        !d.isAfter(end);
        d = DateTime(d.year, d.month, d.day + 1)
      )
        if (calendar.contains(d)) _edited[d] ?? _generated(d),
    ];
    return CalendarDaysPeriod(
      calendarId: id,
      view: view,
      startDate: start,
      endDate: end,
      days: days,
      totals: _totals(days),
    );
  }

  @override
  Future<CalendarDay> updateDay(
    String id,
    DateTime date,
    CalendarDayUpdate input,
  ) async {
    calls.add('updateDay');
    dayUpdate = input;
    _maybeFail();
    final current = _edited[date] ?? _generated(date);
    return _edited[date] = CalendarDay(
      date: date,
      weekday: current.weekday,
      type: input.type ?? current.type,
      description: input.toJson()['description'] as String?,
    );
  }

  static CalendarDay _generated(DateTime d) {
    final weekday = d.weekday % 7;
    final weekend = weekday == 0 || weekday == 6;
    return CalendarDay(
      date: d,
      weekday: weekday,
      type: weekend ? CalendarDayType.nonSchoolDay : CalendarDayType.schoolDay,
    );
  }

  static (DateTime, DateTime) _period(CalendarView view, DateTime d) =>
      switch (view) {
        CalendarView.day => (d, d),
        CalendarView.week => (
          DateTime(d.year, d.month, d.day - d.weekday % 7),
          DateTime(d.year, d.month, d.day - d.weekday % 7 + 6),
        ),
        CalendarView.month => (
          DateTime(d.year, d.month),
          DateTime(d.year, d.month + 1, 0),
        ),
        CalendarView.year => (DateTime(d.year), DateTime(d.year, 12, 31)),
      };

  static DayTypeTotals _totals(List<CalendarDay> days) => DayTypeTotals(
    counts: <CalendarDayType, int>{
      for (final t in CalendarDayType.values)
        t: days.where((d) => d.type == t).length,
    },
    total: days.length,
  );
}
