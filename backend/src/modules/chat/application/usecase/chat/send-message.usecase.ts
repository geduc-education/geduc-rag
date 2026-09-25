import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { ConversationEntity } from '../../../domain/entities/conversation.entity';
import {
  MessageCitation,
  MessageEntity,
} from '../../../domain/entities/message.entity';
import { IConversationRepository } from '../../interface/repository/conversation.repository.interface';
import { IRetrievalContextGateway } from '../../interface/gateways/retrieval-context.gateway.interface';
import { IAnswerGenerationGateway } from '../../interface/gateways/answer-generation.gateway.interface';
import { IUseCase } from '../../../../../@core/shared/use-case.interface';
import NotFound from '../../../../../@core/shared/exceptions/400/not-found-error';

export interface SendMessageInput {
  tenantId: string;
  userId: string;
  conversationId?: string;
  question: string;
}

export interface SendMessageOutput {
  conversationId: string;
  answer: string;
  citations: MessageCitation[];
}

/** Orquestra o RAG ponta a ponta: retrieval → generation → persiste o turno com citações. */
export class SendMessageUseCase implements IUseCase {
  private readonly logger = new Logger(SendMessageUseCase.name);

  constructor(
    private readonly conversationRepository: IConversationRepository,
    private readonly retrievalContextGateway: IRetrievalContextGateway,
    private readonly answerGenerationGateway: IAnswerGenerationGateway,
  ) {}

  async execute(input: SendMessageInput): Promise<SendMessageOutput> {
    const conversation = await this.loadOrCreateConversation(input);
    const userMessage = conversation.addMessage({
      role: 'user',
      content: input.question,
    });
    const history = this.buildHistory(conversation, userMessage);

    const { contextChunks, citations } =
      await this.retrievalContextGateway.retrieve(
        input.tenantId,
        input.question,
      );
    const { answer } = await this.answerGenerationGateway.generate({
      question: input.question,
      contextChunks,
      history,
    });

    conversation.addMessage({ role: 'assistant', content: answer, citations });
    await this.conversationRepository.save(conversation);

    this.logger.debug(
      `Turno registrado na conversa ${conversation.conversationId}`,
    );
    return { conversationId: conversation.conversationId, answer, citations };
  }

  /**
   * Sem `conversationId`, abre uma conversa nova do usuário. Com ele, só carrega
   * a conversa do próprio (tenant, usuário); id alheio ou inexistente é 404 —
   * criar com esse id colidiria com a conversa de outro usuário.
   */
  private async loadOrCreateConversation(
    input: SendMessageInput,
  ): Promise<ConversationEntity> {
    if (!input.conversationId) {
      return ConversationEntity.create({
        conversationId: randomUUID(),
        tenantId: input.tenantId,
        userId: input.userId,
      });
    }
    const existing = await this.conversationRepository.findById(
      input.tenantId,
      input.userId,
      input.conversationId,
    );
    if (!existing) throw new NotFound('Conversa não encontrada.');
    return existing;
  }

  private buildHistory(
    conversation: ConversationEntity,
    currentMessage: MessageEntity,
  ) {
    return conversation.historyBefore(currentMessage).map((message) => ({
      role: message.role,
      content: message.content,
    }));
  }
}
