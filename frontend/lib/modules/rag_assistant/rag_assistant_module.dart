import 'package:flutter_modular/flutter_modular.dart';

import '../../core/auth/app_permissions.dart';
import '../auth/guards/permission_guard.dart';
import 'presentation/chat/chat_binds.dart';
import 'presentation/chat/chat_page.dart';
import 'presentation/documents/documents_binds.dart';
import 'presentation/documents/documents_page.dart';

/// Redirect de quem acessa uma rota do RAG sem a permissão exigida.
const String _ragForbiddenRedirect = '/home/dashboard';

/// DI do assistente RAG, **reancorado no escopo do shell** (`/home`) — ver o
/// padrão em `home_module.dart`. Cada tela registra os próprios binds no seu
/// `*_binds.dart`, para que Documentos e Chat evoluam sem disputar este
/// arquivo.
void registerRagAssistantBinds(ModularContext c) {
  registerRagDocumentsBinds(c);
  registerRagChatBinds(c);
}

/// Rotas do assistente RAG sob `/home/rag/...`, protegidas pela permissão de
/// cada tela (URL direta não fura o gating do menu).
void registerRagAssistantRoutes(ModularContext r) {
  r
    ..route(
      '/rag/documents',
      guards: [
        permissionGuard(
          AppPermissions.documentRead,
          redirectTo: _ragForbiddenRedirect,
        ),
      ],
      child: (context, state) => const DocumentsPage(),
    )
    ..route(
      '/rag/chat',
      guards: [
        permissionGuard(
          AppPermissions.chatQuery,
          redirectTo: _ragForbiddenRedirect,
        ),
      ],
      child: (context, state) => const ChatPage(),
    );
}
