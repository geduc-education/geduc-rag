import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/theme/app_dimensions.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/colors_app.dart';

/// Toast padrão da plataforma — ponto ÚNICO do feedback efêmero de ação.
///
/// Substitui o SnackBar (que o Material ancora no rodapé): os toasts aparecem
/// no TOPO-CENTRO, com cor pelo tipo, empilhados (um persistente convive com
/// os efêmeros) e ACIMA do Navigator — visíveis inclusive sobre diálogos, ao
/// contrário do SnackBar, que ficava atrás da barreira modal.
///
/// A camada [AppToastLayer] é montada uma vez no `builder` do MaterialApp
/// (`app_widget.dart`) e publica o [AppToastController] por InheritedWidget:
/// [showAppToast] resolve pelo `context` — em harness de teste sem a camada,
/// vira no-op silencioso (teste que assere a mensagem monta a camada).
enum AppToastType { success, error, warning, info }

/// Ação opcional do toast (ex.: "Atender" no alerta de novo atendimento).
class AppToastAction {
  const AppToastAction({required this.label, required this.onPressed});

  final String label;
  final VoidCallback onPressed;
}

/// Um toast vivo na pilha do controller.
class AppToastData {
  const AppToastData({
    required this.id,
    required this.message,
    required this.type,
    required this.duration,
    this.actions = const <AppToastAction>[],
    this.persistent = false,
  });

  final int id;
  final String message;
  final AppToastType type;

  /// Ignorada quando [persistent] — o toast só sai no X ou ao agir.
  final Duration duration;

  /// Ações do toast (0..n — ex.: "Atender", ou "Recusar"+"Aceitar" no
  /// convite). Agir também fecha o toast.
  final List<AppToastAction> actions;
  final bool persistent;
}

/// Pilha de toasts. Vive no [AppToastLayer]; os timers de auto-dismiss ficam
/// nos tiles (cancelados no dispose — nada pendura quando a árvore cai).
class AppToastController extends ChangeNotifier {
  static const int _maxVisible = 5;

  /// Duração default por tipo: erro fica mais tempo na tela.
  static const Map<AppToastType, Duration> _durations =
      <AppToastType, Duration>{
        AppToastType.success: Duration(seconds: 4),
        AppToastType.info: Duration(seconds: 4),
        AppToastType.warning: Duration(seconds: 5),
        AppToastType.error: Duration(seconds: 6),
      };

  final List<AppToastData> _toasts = <AppToastData>[];
  int _seq = 0;

  List<AppToastData> get toasts => List<AppToastData>.unmodifiable(_toasts);

  /// Empilha um toast e devolve o id (para dismiss programático). Estouro do
  /// teto derruba o mais antigo NÃO persistente — pico de eventos não vira
  /// parede de toasts.
  int show(
    String message, {
    AppToastType type = AppToastType.info,
    Duration? duration,
    List<AppToastAction> actions = const <AppToastAction>[],
    bool persistent = false,
  }) {
    final toast = AppToastData(
      id: ++_seq,
      message: message,
      type: type,
      duration: duration ?? _durations[type]!,
      actions: actions,
      persistent: persistent,
    );
    if (_toasts.length >= _maxVisible) {
      final victim = _toasts.indexWhere((t) => !t.persistent);
      if (victim != -1) _toasts.removeAt(victim);
    }
    _toasts.add(toast);
    notifyListeners();
    return toast.id;
  }

  void dismiss(int id) {
    final before = _toasts.length;
    _toasts.removeWhere((t) => t.id == id);
    if (_toasts.length != before) notifyListeners();
  }

  void clear() {
    if (_toasts.isEmpty) return;
    _toasts.clear();
    notifyListeners();
  }
}

/// Exibe um toast no topo da tela. [context] só localiza a camada — pode ser
/// chamado de página, diálogo ou host do shell. Sem camada acima (harness
/// cru), não faz nada. Devolve o id do toast (dismiss programático via
/// [AppToastLayer.maybeOf]), ou `null` sem camada.
int? showAppToast(
  BuildContext context,
  String message, {
  AppToastType type = AppToastType.info,
  Duration? duration,
  List<AppToastAction> actions = const <AppToastAction>[],
  bool persistent = false,
}) {
  return AppToastLayer.maybeOf(context)?.show(
    message,
    type: type,
    duration: duration,
    actions: actions,
    persistent: persistent,
  );
}

/// Camada dos toasts: envolve o app inteiro (builder do MaterialApp) e
/// desenha a pilha no topo-centro, acima de qualquer rota.
class AppToastLayer extends StatefulWidget {
  const AppToastLayer({super.key, required this.child, this.controller});

  final Widget child;

  /// Injetável para testes; por default a camada cria e possui o seu.
  final AppToastController? controller;

  static AppToastController? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<_AppToastScope>()?.controller;

  @override
  State<AppToastLayer> createState() => _AppToastLayerState();
}

class _AppToastLayerState extends State<AppToastLayer> {
  AppToastController? _owned;

  AppToastController get _controller =>
      widget.controller ?? (_owned ??= AppToastController());

  @override
  void dispose() {
    _owned?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _AppToastScope(
      controller: _controller,
      child: Stack(
        textDirection: TextDirection.ltr,
        children: <Widget>[
          widget.child,
          AnimatedBuilder(
            animation: _controller,
            builder: (context, _) {
              final toasts = _controller.toasts;
              if (toasts.isEmpty) return const SizedBox.shrink();
              return Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.only(top: AppDimensions.gapMd),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        for (final toast in toasts)
                          Padding(
                            padding: const EdgeInsets.only(
                              bottom: AppDimensions.gapSm,
                            ),
                            child: AppToastTile(
                              key: ValueKey<int>(toast.id),
                              toast: toast,
                              onDismiss: () => _controller.dismiss(toast.id),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _AppToastScope extends InheritedWidget {
  const _AppToastScope({required this.controller, required super.child});

  final AppToastController controller;

  @override
  bool updateShouldNotify(_AppToastScope oldWidget) =>
      controller != oldWidget.controller;
}

/// Tile de um toast: cor sólida do tipo, ícone, mensagem, ações e X. O timer
/// de auto-dismiss vive aqui (cancelado no dispose). Público para os testes
/// escoparem o texto DO TOAST (a mesma frase pode existir num campo da tela).
class AppToastTile extends StatefulWidget {
  const AppToastTile({super.key, required this.toast, required this.onDismiss});

  final AppToastData toast;
  final VoidCallback onDismiss;

  @override
  State<AppToastTile> createState() => _AppToastTileState();
}

class _AppToastTileState extends State<AppToastTile> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    if (!widget.toast.persistent) {
      _timer = Timer(widget.toast.duration, widget.onDismiss);
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  (Color, IconData) _styleFor(ColorsApp colors) => switch (widget.toast.type) {
    AppToastType.success => (colors.success, Icons.check_circle_outline),
    AppToastType.error => (colors.error, Icons.error_outline),
    AppToastType.warning => (colors.warning, Icons.warning_amber_outlined),
    AppToastType.info => (colors.info700, Icons.info_outline),
  };

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final (background, icon) = _styleFor(colors);
    final foreground = colors.white;
    final toast = widget.toast;
    final maxWidth = MediaQuery.sizeOf(context).width - 2 * AppDimensions.gapMd;
    // SEM animação de entrada, de propósito: o tile nasce 100% visível. A
    // versão com TweenAnimationBuilder (opacity 0→1) ficava PERMANENTEMENTE
    // invisível quando o toast nascia de evento de socket (QA de 11/08 no
    // build release): o tile montava, o timer de 6 s corria e expirava, e o
    // primeiro frame da animação nunca avançava — toast de gesto pintava,
    // toast de socket não. Preferimos aparição instantânea confiável a uma
    // animação que depende do agendamento de frames do caminho que a montou.
    return Material(
      color: background,
      elevation: 6,
      borderRadius: AppDimensions.borderRadius,
      child: Container(
        constraints: BoxConstraints(
          maxWidth: maxWidth < AppDimensions.toastWidth
              ? maxWidth
              : AppDimensions.toastWidth,
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: AppDimensions.gapMd,
          vertical: AppDimensions.gapSm,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(icon, size: 20, color: foreground),
            AppDimensions.hGapSm,
            Flexible(
              child: Text(
                toast.message,
                style: context.textStyles.textSmall.copyWith(color: foreground),
              ),
            ),
            for (final action in toast.actions) ...<Widget>[
              AppDimensions.hGapSm,
              TextButton(
                onPressed: () {
                  widget.onDismiss();
                  action.onPressed();
                },
                style: TextButton.styleFrom(
                  foregroundColor: foreground,
                  visualDensity: VisualDensity.compact,
                ),
                child: Text(
                  action.label,
                  style: context.textStyles.textSmallBold.copyWith(
                    color: foreground,
                  ),
                ),
              ),
            ],
            AppDimensions.hGapSm,
            // SEM `tooltip:`: o Tooltip exige um Overlay acima, e esta
            // camada vive justamente ACIMA do Navigator (dono do Overlay).
            IconButton(
              visualDensity: VisualDensity.compact,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
              iconSize: 16,
              color: foreground,
              icon: const Icon(Icons.close, semanticLabel: 'Fechar'),
              onPressed: widget.onDismiss,
            ),
          ],
        ),
      ),
    );
  }
}
