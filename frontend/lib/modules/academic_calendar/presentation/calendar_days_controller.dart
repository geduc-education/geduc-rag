import 'package:flutter/foundation.dart';

import '../../../core/tenancy/tenant_context.dart';
import '../data/academic_calendar_repository.dart';
import '../data/models/academic_calendar.dart';
import '../data/models/calendar_day.dart';
import '../data/models/calendar_day_type.dart';
import '../data/models/day_type_totals.dart';
import 'calendar_error_messages.dart';

/// Estado da carga dos dias do período exibido.
enum CalendarDaysState { idle, loading, ready, error }

const String _loadFallback = 'Não foi possível carregar os dias do calendário.';
const String _dayFallback = 'Não foi possível salvar o dia.';

/// Controller do calendário aberto: visão (dia/semana/mês/ano), data de
/// referência, dias do período com o quantitativo por tipo e a edição de um
/// dia. Singleton no escopo do shell, ao lado da listagem.
class CalendarDaysController extends ChangeNotifier {
  CalendarDaysController(
    this._repository, {
    TenantContext? tenants,
    DateTime Function()? clock,
  }) : _tenants = tenants,
       _tenantId = tenants?.activeTenantId,
       _clock = clock ?? DateTime.now {
    tenants?.addListener(_onTenantChanged);
  }

  final IAcademicCalendarRepository _repository;
  final TenantContext? _tenants;
  final DateTime Function() _clock;
  String? _tenantId;
  int _generation = 0;

  AcademicCalendar? _calendar;
  CalendarView _view = CalendarView.month;
  DateTime _date = DateTime(2000);
  CalendarDaysState _state = CalendarDaysState.idle;
  String? _error;
  CalendarDaysPeriod? _period;
  Map<DateTime, CalendarDay> _byDate = const <DateTime, CalendarDay>{};

  /// Calendário aberto; `null` = nenhum selecionado.
  AcademicCalendar? get calendar => _calendar;
  CalendarView get view => _view;

  /// Data de referência: a visão exibida é a que contém este dia.
  DateTime get date => _date;
  CalendarDaysState get state => _state;
  String? get error => _error;
  CalendarDaysPeriod? get period => _period;
  List<CalendarDay> get days => _period?.days ?? const <CalendarDay>[];
  DayTypeTotals get totals => _period?.totals ?? DayTypeTotals.empty;

  bool get canGoPrevious {
    final period = _period;
    final calendar = _calendar;
    return period != null &&
        calendar != null &&
        period.startDate.isAfter(calendar.startDate);
  }

  bool get canGoNext {
    final period = _period;
    final calendar = _calendar;
    return period != null &&
        calendar != null &&
        period.endDate.isBefore(calendar.endDate);
  }

  /// Dia [date] do período carregado; `null` = fora do calendário/período.
  CalendarDay? dayOn(DateTime date) =>
      _byDate[DateTime(date.year, date.month, date.day)];

  /// Abre [calendar] no dia de hoje (se estiver no período) ou no início.
  Future<void> open(AcademicCalendar calendar) {
    _calendar = calendar;
    final today = _clock();
    _date = calendar.contains(today)
        ? DateTime(today.year, today.month, today.day)
        : calendar.startDate;
    return load();
  }

  /// Troca os dados do calendário aberto (ex.: após editar nome/escolas).
  void replaceCalendar(AcademicCalendar calendar) {
    if (_calendar?.id != calendar.id) return;
    _calendar = calendar;
    notifyListeners();
  }

  /// Fecha o calendário aberto (excluído, troca de tenant).
  void close() {
    _generation++;
    _calendar = null;
    _period = null;
    _byDate = const <DateTime, CalendarDay>{};
    _error = null;
    _state = CalendarDaysState.idle;
    notifyListeners();
  }

  Future<void> setView(CalendarView view) {
    if (view == _view) return Future<void>.value();
    _view = view;
    return load();
  }

  /// Vai para a [view] que contém [date] (ex.: clicar num mês da visão ano).
  Future<void> goTo(DateTime date, {CalendarView? view}) {
    _date = DateTime(date.year, date.month, date.day);
    if (view != null) _view = view;
    return load();
  }

  Future<void> previous() => canGoPrevious ? _step(-1) : Future<void>.value();

  Future<void> next() => canGoNext ? _step(1) : Future<void>.value();

  /// Recarrega o período atual. Respostas ultrapassadas são descartadas.
  Future<void> load() async {
    final calendar = _calendar;
    if (calendar == null) return;
    final generation = ++_generation;
    _state = CalendarDaysState.loading;
    notifyListeners();
    CalendarDaysPeriod? period;
    final error = await runCalendarAction(() async {
      period = await _repository.listDays(
        calendar.id,
        view: _view,
        date: _date,
      );
    }, fallback: _loadFallback);
    if (generation != _generation) return;
    _apply(period, error);
    notifyListeners();
  }

  /// Atualiza tipo/descrição de [day] e recarrega o período (o quantitativo
  /// muda). `null` em sucesso; senão a mensagem para o diálogo.
  Future<String?> updateDay(CalendarDay day, CalendarDayUpdate input) async {
    final calendar = _calendar;
    if (calendar == null) return _dayFallback;
    final error = await runCalendarAction(
      () => _repository.updateDay(calendar.id, day.date, input),
      fallback: _dayFallback,
    );
    if (error == null) await load();
    return error;
  }

  Future<void> _step(int delta) {
    final d = _date;
    _date = switch (_view) {
      CalendarView.day => DateTime(d.year, d.month, d.day + delta),
      CalendarView.week => DateTime(d.year, d.month, d.day + 7 * delta),
      CalendarView.month => DateTime(d.year, d.month + delta),
      CalendarView.year => DateTime(d.year + delta),
    };
    return load();
  }

  void _apply(CalendarDaysPeriod? period, String? error) {
    if (error != null || period == null) {
      _error = error ?? _loadFallback;
      _state = CalendarDaysState.error;
      return;
    }
    _period = period;
    _byDate = <DateTime, CalendarDay>{for (final d in period.days) d.date: d};
    _error = null;
    _state = CalendarDaysState.ready;
  }

  void _onTenantChanged() {
    final tenantId = _tenants?.activeTenantId;
    if (tenantId == _tenantId) return;
    _tenantId = tenantId;
    if (_calendar != null) close();
  }

  @override
  void dispose() {
    _tenants?.removeListener(_onTenantChanged);
    super.dispose();
  }
}
