import 'package:flutter_modular/flutter_modular.dart';

import '../../../../core/tenancy/tenant_context.dart';

import '../../data/rag_chat_repository.dart';
import 'chat_controller.dart';

/// Binds da tela Chat. O repositório é registrado em
/// `registerRagAssistantBinds`; aqui entra só o controller, singleton no
/// escopo do shell para a conversa sobreviver à troca de aba; ele observa o
/// [TenantContext] e descarta a conversa quando o tenant ativo muda.
void registerRagChatBinds(ModularContext c) {
  c.addLazySingleton<ChatController>(
    () => ChatController(
      inject<IRagChatRepository>(),
      tenants: inject<TenantContext>(),
    ),
  );
}
