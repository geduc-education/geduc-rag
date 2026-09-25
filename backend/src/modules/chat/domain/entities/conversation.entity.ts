import { MessageEntity, MessageProps } from './message.entity';

export interface ConversationProps {
  conversationId: string;
  tenantId: string;
  userId: string;
  messages?: MessageEntity[];
  createdAt?: Date;
}

/**
 * Uma conversa por `conversationId`, pertencente a (tenant, usuário) — dona do
 * histórico de turnos usado como memória do RAG.
 */
export class ConversationEntity {
  readonly conversationId: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly messages: MessageEntity[];
  readonly createdAt: Date;

  private constructor(props: ConversationProps) {
    this.conversationId = props.conversationId;
    this.tenantId = props.tenantId;
    this.userId = props.userId;
    this.messages = props.messages ?? [];
    this.createdAt = props.createdAt ?? new Date();
  }

  static create(props: ConversationProps): ConversationEntity {
    return new ConversationEntity(props);
  }

  addMessage(props: MessageProps): MessageEntity {
    const message = MessageEntity.create(props);
    this.messages.push(message);
    return message;
  }

  /** Histórico ANTES do turno atual — usado como memória no prompt, sem incluir a pergunta corrente. */
  historyBefore(currentMessage: MessageEntity): MessageEntity[] {
    return this.messages.filter((message) => message !== currentMessage);
  }
}
