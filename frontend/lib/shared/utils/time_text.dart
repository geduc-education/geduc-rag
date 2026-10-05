// Horas no formato `HH:mm` (00:00 a 23:59), como o backend exige. Textos
// nesse formato são comparáveis diretamente (`compareTo`).

final RegExp _timePattern = RegExp(r'^([01]\d|2[0-3]):[0-5]\d$');

/// Hora `HH:mm` válida (00:00 a 23:59).
bool isValidTimeText(String value) => _timePattern.hasMatch(value);

/// Intervalo `07:00–07:50`.
String formatTimeRange(String start, String end) => '$start–$end';
