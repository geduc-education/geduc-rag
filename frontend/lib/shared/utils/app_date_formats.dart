import 'package:intl/intl.dart';

/// Formatos de data/hora compartilhados da UI — fonte única dos padrões
/// numéricos via `DateFormat` do `intl` (sem `initializeDateFormatting`).
///
/// Entradas string ISO com offset devem ser parseadas com
/// `DateTime.parse(...).toLocal()` **antes** do format — sem o `toLocal()`
/// a exibição cairia no dia/hora errados do fuso do usuário.

final DateFormat _shortDate = DateFormat('dd/MM');
final DateFormat _date = DateFormat('dd/MM/yyyy');
final DateFormat _dateTime = DateFormat('dd/MM/yyyy HH:mm');
final DateFormat _isoLocal = DateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS");

/// `dd/MM` — ex.: chips de período dos filtros de chamados.
String formatShortDate(DateTime date) => _shortDate.format(date);

/// `dd/MM/yyyy` — ex.: campos de data do painel de filtros.
String formatDate(DateTime date) => _date.format(date);

/// `dd/MM/yyyy HH:mm` — ex.: carimbos de criação/atualização de chamados.
String formatDateTime(DateTime date) => _dateTime.format(date);

/// ISO8601 do [local] com o offset do dispositivo explícito
/// (ex.: `2026-07-01T00:00:00.000-03:00`) — `toIso8601String()` de um
/// `DateTime` local NÃO inclui offset, então o sufixo é montado à mão.
String formatIsoWithLocalOffset(DateTime local) {
  String two(int n) => n.toString().padLeft(2, '0');
  final offset = local.timeZoneOffset;
  final sign = offset.isNegative ? '-' : '+';
  final abs = offset.abs();
  return '${_isoLocal.format(local)}$sign${two(abs.inHours)}:'
      '${two(abs.inMinutes.remainder(60))}';
}
