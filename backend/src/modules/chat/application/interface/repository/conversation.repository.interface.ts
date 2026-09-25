import { ConversationEntity } from '../../../domain/entities/conversation.entity';

export interface IConversationRepository {
  /** Só devolve a conversa se ela pertencer ao par (tenant, usuário); caso contrário, `null`. */
  findById(
    tenantId: string,
    userId: string,
    conversationId: string,
  ): Promise<ConversationEntity | null>;
  save(conversation: ConversationEntity): Promise<void>;
}
