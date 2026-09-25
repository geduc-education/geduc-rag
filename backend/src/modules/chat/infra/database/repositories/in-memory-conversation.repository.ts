import { Injectable } from '@nestjs/common';
import { ConversationEntity } from '../../../domain/entities/conversation.entity';
import { IConversationRepository } from '../../../application/interface/repository/conversation.repository.interface';

/** Ver `CLAUDE.md` ("Estado atual") — troca por repositório com `IDatabaseConnection` real. */
@Injectable()
export class InMemoryConversationRepository implements IConversationRepository {
  private readonly conversations = new Map<string, ConversationEntity>();

  async findById(
    tenantId: string,
    conversationId: string,
  ): Promise<ConversationEntity | null> {
    return this.conversations.get(this.key(tenantId, conversationId)) ?? null;
  }

  async save(conversation: ConversationEntity): Promise<void> {
    this.conversations.set(
      this.key(conversation.tenantId, conversation.conversationId),
      conversation,
    );
  }

  private key(tenantId: string, conversationId: string): string {
    return `${tenantId}:${conversationId}`;
  }
}
