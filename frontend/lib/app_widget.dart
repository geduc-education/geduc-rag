import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_modular/flutter_modular.dart';

import 'core/http/api_client.dart';
import 'core/theme/app_theme.dart';
import 'modules/auth/services/session_service.dart';
import 'shared/components/feedback/app_toast.dart';

/// Chave do Navigator raiz. Permite navegar a partir de callbacks fora da
/// árvore de widgets (os handlers 401/403 do [ApiClient] não recebem um
/// `BuildContext`). Passada ao `ModularApp` no boot e usada em [_navigate].
final GlobalKey<NavigatorState> appNavigatorKey = GlobalKey<NavigatorState>();

/// Widget raiz. Usa `MaterialApp.router` com o `routerConfig` do Modular v7
/// (`ModularApp.routerConfigOf`).
///
/// No boot: registra os handlers globais de `401` (sessão expirada → login) e
/// de `403 PASSWORD_CHANGE_REQUIRED` (troca de senha obrigatória pendente →
/// tela de troca) e rehidrata a sessão a partir do token persistido.
///
/// A rehidratação (`restore`) é assíncrona (lê o storage + `GET /auth/me`),
/// mas os guards (`authGuard`) leem o estado da sessão de forma síncrona. Por
/// isso o router só é montado **após** o `restore` concluir: enquanto isso uma
/// splash é exibida. Sem esse gate, no reload da web o guard avaliaria a sessão
/// ainda vazia e redirecionaria ao login toda vez.
class AppRoot extends StatefulWidget {
  const AppRoot({super.key});

  @override
  State<AppRoot> createState() => _AppRootState();
}

class _AppRootState extends State<AppRoot> {
  /// `true` enquanto a sessão é rehidratada; segura o router até concluir.
  bool _booting = true;

  @override
  void initState() {
    super.initState();
    _bootstrapSession();
  }

  Future<void> _bootstrapSession() async {
    inject<ApiClient>()
      ..setUnauthorizedHandler(_onUnauthorized)
      ..setPasswordChangeRequiredHandler(_onPasswordChangeRequired);
    await inject<SessionService>().restore();
    if (mounted) setState(() => _booting = false);
  }

  /// Navega a partir de um callback fora da árvore de widgets, via o context do
  /// Navigator raiz (abaixo do `Router`, onde `context.navigate` resolve o
  /// delegate). Se o router ainda não montou, não há para onde ir.
  void _navigate(String path) {
    final context = appNavigatorKey.currentContext;
    if (context != null) context.navigate(path);
  }

  /// Sessão expirada/invalidada em qualquer requisição: volta ao login.
  ///
  /// Durante o boot o router ainda não está montado; nesse caso o `restore` já
  /// limpa a sessão e os guards levam ao login — navegar aqui seria perdido.
  void _onUnauthorized() {
    if (_booting) return;
    inject<SessionService>().logout();
    _navigate('/auth/login');
  }

  /// Troca de senha obrigatória pendente (backend bloqueia rotas autenticadas
  /// com `403 PASSWORD_CHANGE_REQUIRED`): desvia à tela de troca em vez de
  /// exibir erro inline. Não desloga — a sessão segue válida para a troca.
  ///
  /// Ignorado no boot: o `mustChangePasswordGuard` já faz esse desvio na rota
  /// inicial a partir do `mustChangePassword` do usuário rehidratado.
  void _onPasswordChangeRequired() {
    if (_booting) return;
    _navigate('/auth/change-password');
  }

  @override
  Widget build(BuildContext context) {
    const localizationsDelegates = [
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ];
    const supportedLocales = [Locale('pt', 'BR')];

    // Enquanto a sessão rehidrata, exibe a splash — sem router, para o
    // `authGuard` não avaliar uma sessão ainda vazia e cair no login.
    if (_booting) {
      return const MaterialApp(
        title: 'GEDUC RAG',
        debugShowCheckedModeBanner: false,
        localizationsDelegates: localizationsDelegates,
        supportedLocales: supportedLocales,
        home: Scaffold(body: Center(child: CircularProgressIndicator())),
      );
    }

    return MaterialApp.router(
      title: 'GEDUC RAG',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.light,
      localizationsDelegates: localizationsDelegates,
      supportedLocales: supportedLocales,
      // Camada única dos toasts (topo-centro), ACIMA do Navigator: visível em
      // qualquer rota e sobre diálogos. O controller vem do DI (singleton).
      builder: (context, child) => AppToastLayer(
        controller: inject<AppToastController>(),
        child: child ?? const SizedBox.shrink(),
      ),
      routerConfig: ModularApp.routerConfigOf(context),
    );
  }
}
