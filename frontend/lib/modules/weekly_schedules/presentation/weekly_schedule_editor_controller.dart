import 'package:flutter/foundation.dart';

import '../../../core/errors/app_exception.dart';
import '../../../shared/utils/app_date_formats.dart';
import '../../academic_calendar/data/models/calendar_day_type.dart';
import '../data/models/schedule_day.dart';
import '../data/models/schedule_lookups.dart';
import '../data/models/schedule_week.dart';
import '../data/models/weekly_schedule.dart';
import '../data/weekly_schedules_repository.dart';
import 'schedule_error_messages.dart';
import 'schedule_lesson_rules.dart';
import 'weekly_schedule_editor_args.dart';

/// Estado de tela do editor da semana.
enum ScheduleEditorState { loading, ready, error }

const String _loadFallback = 'Não foi possível carregar o horário.';
const String _saveFallback = 'Não foi possível salvar o horário.';
const String _recordFallback = 'Não foi possível atualizar o registro da aula.';

/// Controller do editor da semana (segunda → domingo): carrega o horário ou
/// prevê os tipos dos dias de uma semana nova, edita as aulas com as regras
/// do backend (só dia letivo, horário da escola sem repetir no dia, aula
/// registrada travada, sábado letivo com aula) e salva via POST/PUT.
/// Instanciado na página.
class WeeklyScheduleEditorController extends ChangeNotifier {
  WeeklyScheduleEditorController(this._repository);

  final IWeeklySchedulesRepository _repository;

  ScheduleEditorState _state = ScheduleEditorState.loading;
  String? _loadError;
  String? _saveError;
  DateTime? _highlighted;
  bool _saving = false;
  bool _dirty = false;
  WeeklySchedule? _schedule;
  String? _schoolClassId;
  DateTime _monday = scheduleMondayOf(DateTime.now());
  List<ScheduleDay> _days = const <ScheduleDay>[];
  List<ScheduleSubject> _subjects = const <ScheduleSubject>[];
  List<ScheduleLessonSlot> _slots = const <ScheduleLessonSlot>[];

  ScheduleEditorState get state => _state;
  String? get loadError => _loadError;
  String? get saveError => _saveError;
  bool get saving => _saving;
  bool get dirty => _dirty;
  bool get isNew => _schedule == null;
  DateTime get monday => _monday;
  String get periodLabel => formatScheduleWeek(_monday);
  ScheduleStatus? get status => _schedule?.summary.status;
  List<ScheduleDay> get days => _days;
  List<ScheduleSubject> get subjects => _subjects;

  /// Horários de aula da escola da turma, na ordem da API.
  List<ScheduleLessonSlot> get slots => _slots;
  bool get hasSlots => _slots.isNotEmpty;

  /// Dia destacado por erro (sábado letivo sem aula).
  DateTime? get highlightedDate => _highlighted;

  /// Primeiro sábado letivo sem aula — bloqueia o salvamento.
  ScheduleDay? get blockingSaturday =>
      _days.where((d) => d.needsLesson).firstOrNull;

  ScheduleDay? dayOn(DateTime date) =>
      _days.where((d) => isSameCalendarDay(d.date, date)).firstOrNull;

  Future<void> open(WeeklyScheduleEditorArgs args) async {
    _state = ScheduleEditorState.loading;
    notifyListeners();
    final error = await runScheduleAction(
      () => _load(args),
      fallback: _loadFallback,
    );
    _loadError = error;
    _state = error == null
        ? ScheduleEditorState.ready
        : ScheduleEditorState.error;
    notifyListeners();
  }

  Future<void> _load(WeeklyScheduleEditorArgs args) async {
    final id = args.scheduleId;
    if (id != null) {
      final (schedule, subjects) = await (
        _repository.getById(id),
        _repository.listSubjects(),
      ).wait;
      final schoolId =
          args.schoolId ??
          (await _repository.getClass(schedule.summary.schoolClassId)).schoolId;
      _slots = await _repository.listLessonSlots(schoolId);
      _subjects = subjects;
      _applySchedule(schedule);
      return;
    }
    final schoolClass = args.schoolClass!;
    _schoolClassId = schoolClass.id;
    _monday = scheduleMondayOf(args.date ?? DateTime.now());
    final (days, subjects, slots) = await (
      _repository.previewWeek(schoolClass.schoolId, _monday),
      _repository.listSubjects(),
      _repository.listLessonSlots(schoolClass.schoolId),
    ).wait;
    _subjects = subjects;
    _slots = slots;
    _days = days;
  }

  /// Horários já ocupados no dia, exceto o da aula [except] (em edição).
  Set<String> usedSlotIds(DateTime date, {int? except}) {
    final day = dayOn(date);
    return day == null
        ? const <String>{}
        : usedLessonSlotIds(day, except: except);
  }

  /// Adiciona [draft] ao dia; devolve a mensagem de erro ou `null`.
  String? addLesson(DateTime date, ScheduleLesson draft) =>
      _change(date, draft, null);

  /// Substitui a aula [index] do dia por [draft].
  String? updateLesson(DateTime date, int index, ScheduleLesson draft) =>
      _change(date, draft, index);

  /// Remove a aula [index]; aula registrada não sai.
  String? removeLesson(DateTime date, int index) {
    final day = dayOn(date);
    if (day == null) return 'Dia fora da semana.';
    if (day.lessons[index].isRecorded) return lockedLessonMessage;
    _replaceDay(
      day.withLessons(<ScheduleLesson>[...day.lessons]..removeAt(index)),
    );
    return null;
  }

  String? _change(DateTime date, ScheduleLesson draft, int? index) {
    final day = dayOn(date);
    if (day == null) return 'Dia fora da semana.';
    if (!hasSlots) return noLessonSlotsMessage;
    final error = validateScheduleLesson(day, draft, replacing: index);
    if (error != null) return error;
    final slot = _slots.where((s) => s.id == draft.lessonSlotId).firstOrNull;
    if (slot == null) return 'Horário de aula inválido para esta escola.';
    final lesson = ScheduleLesson(
      lessonSlotId: slot.id,
      slotName: slot.name,
      startTime: slot.startTime,
      endTime: slot.endTime,
      subjectId: draft.subjectId,
      subjectName: _subjectName(draft.subjectId),
    );
    final lessons = <ScheduleLesson>[...day.lessons];
    if (index == null) {
      lessons.add(lesson);
    } else {
      lessons[index] = lesson;
    }
    _replaceDay(day.withLessons(lessons));
    return null;
  }

  /// Salva (POST na semana nova, PUT na existente). `true` em sucesso; senão
  /// [saveError] (e [highlightedDate] no erro do sábado).
  Future<bool> save() async {
    final saturday = blockingSaturday;
    if (saturday != null) {
      _failSave(_saturdayMessage(saturday), saturday.date);
      return false;
    }
    _saving = true;
    _saveError = null;
    notifyListeners();
    try {
      _applySchedule(await _persist());
      _saving = false;
      notifyListeners();
      return true;
    } on AppException catch (e) {
      final sat = e.code == kSaturdayWithoutLessons
          ? _firstSchoolSaturday
          : null;
      _failSave(scheduleErrorMessage(e, fallback: _saveFallback), sat?.date);
    } catch (_) {
      _failSave(_saveFallback, null);
    }
    return false;
  }

  Future<WeeklySchedule> _persist() {
    final schedule = _schedule;
    if (schedule != null) {
      return _repository.update(
        schedule.id,
        UpdateWeeklyScheduleInput(days: _days),
      );
    }
    return _repository.create(
      CreateWeeklyScheduleInput(
        schoolClassId: _schoolClassId ?? '',
        monday: _monday,
        days: _days,
      ),
    );
  }

  /// PATCH do registro de conteúdo/frequência de uma aula já salva.
  Future<String?> toggleRecord(
    DateTime date,
    int index, {
    bool? content,
    bool? attendance,
  }) async {
    final lessonId = dayOn(date)?.lessons[index].id;
    final schedule = _schedule;
    if (lessonId == null || schedule == null) {
      return 'Salve o horário antes de registrar a aula.';
    }
    return runScheduleAction(() async {
      final updated = await _repository.updateLessonRecord(
        schedule.id,
        lessonId,
        LessonRecordUpdate(
          contentRecorded: content,
          attendanceRecorded: attendance,
        ),
      );
      _applyRecord(lessonId, updated);
    }, fallback: _recordFallback);
  }

  /// Só as flags mudam; edições locais pendentes dos demais dias ficam.
  void _applyRecord(String lessonId, ScheduleLesson updated) {
    _days = List<ScheduleDay>.unmodifiable(
      _days.map(
        (day) => day.withLessons(<ScheduleLesson>[
          for (final l in day.lessons)
            l.id == lessonId
                ? l.copyWith(
                    contentRecorded: updated.contentRecorded,
                    attendanceRecorded: updated.attendanceRecorded,
                  )
                : l,
        ]),
      ),
    );
    notifyListeners();
  }

  ScheduleDay? get _firstSchoolSaturday =>
      _days.where((d) => d.isSaturday && d.hasClass).firstOrNull;

  String _saturdayMessage(ScheduleDay day) =>
      'O sábado ${formatShortDate(day.date)} é letivo e precisa de ao menos '
      'uma aula para salvar.';

  void _failSave(String message, DateTime? highlight) {
    _saving = false;
    _saveError = message;
    _highlighted = highlight;
    notifyListeners();
  }

  void _applySchedule(WeeklySchedule schedule) {
    _schedule = schedule;
    _schoolClassId = schedule.summary.schoolClassId;
    _monday = schedule.summary.startDate;
    _days = List<ScheduleDay>.unmodifiable(
      schedule.days.map((d) => d.withLessons(d.lessons)),
    );
    _dirty = false;
    _saveError = null;
    _highlighted = null;
  }

  void _replaceDay(ScheduleDay day) {
    _days = List<ScheduleDay>.unmodifiable(
      _days.map((d) => isSameCalendarDay(d.date, day.date) ? day : d),
    );
    _dirty = true;
    if (_highlighted != null && blockingSaturday == null) {
      _highlighted = null;
      _saveError = null;
    }
    notifyListeners();
  }

  String _subjectName(String id) =>
      _subjects.where((s) => s.id == id).firstOrNull?.name ?? '';
}
