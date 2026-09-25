import { Module } from '@nestjs/common';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { GenerationModule } from '../generation/generation.module';
import { ChatController } from './controllers/chat.controller';
import { CHAT_PROVIDERS } from './chat.providers';

/**
 * Módulo "de borda": orquestra o RAG ponta a ponta. Consome `retrieval` e `generation`
 * exclusivamente via gateway PRÓPRIO (regra de fronteira cross-module).
 */
@Module({
  imports: [RetrievalModule, GenerationModule],
  controllers: [ChatController],
  providers: [
    ...Object.values(CHAT_PROVIDERS.REPOSITORY),
    ...Object.values(CHAT_PROVIDERS.GATEWAY),
    ...Object.values(CHAT_PROVIDERS.USE_CASES),
  ],
})
export class ChatModule {}
