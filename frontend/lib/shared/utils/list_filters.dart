/// Estado de tela das listagens paginadas de cadastro.
enum ListViewState { loading, ready, error, empty }

/// Filtro de status (`?active=`) das listagens de cadastro.
enum ActiveFilter {
  all(null, 'Todos'),
  active(true, 'Ativos'),
  inactive(false, 'Inativos');

  const ActiveFilter(this.queryValue, this.label);

  /// Valor enviado em `?active=`; `null` = sem filtro.
  final bool? queryValue;
  final String label;
}
