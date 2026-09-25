import 'package:flutter_modular/flutter_modular.dart';

import '../../data/rag_documents_repository.dart';
import 'documents_controller.dart';

/// Binds da tela Documentos. O controller é factory (não singleton): cada
/// abertura da tela ganha uma instância e a página a descarta no `dispose`,
/// o que cancela o timer do polling ao sair da tela. O repositório vem de
/// `registerRagAssistantBinds`.
void registerRagDocumentsBinds(ModularContext c) {
  c.add<DocumentsController>(
    () => DocumentsController(inject<IRagDocumentsRepository>()),
  );
}
