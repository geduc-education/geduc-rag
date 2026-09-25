import 'package:flutter/widgets.dart';
import 'package:flutter_modular/flutter_modular.dart';
import 'package:flutter_web_plugins/url_strategy.dart';

import 'app_module.dart';
import 'app_widget.dart';

void main() {
  // URLs amigáveis na web (sem `#`).
  usePathUrlStrategy();
  runApp(
    ModularApp(
      module: appModule,
      initialRoute: '/',
      // Navigator raiz exposto para os handlers 401/403 navegarem fora da
      // árvore de widgets.
      navigatorKey: appNavigatorKey,
      child: const AppRoot(),
    ),
  );
}
