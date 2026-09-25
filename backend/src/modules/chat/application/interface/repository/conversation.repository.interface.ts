import { ConversationEntity } from '../../../domain/entities/conversation.entity';

export interface IConversationRepository {
  findById(
    tenantId: string,
    conversationId: string,
  ): Promise<ConversationEntity | null>;
  save(conversation: ConversationEntity): Promise<void>;
}
