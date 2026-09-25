import { Injectable } from '@nestjs/common';
import {
  ConversationMessage as PrismaConversationMessage,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../../../database/prisma.service';
import { ConversationEntity } from '../../../domain/entities/conversation.entity';
import {
  MessageCitation,
  MessageEntity,
} from '../../../domain/entities/message.entity';
import { IConversationRepository } from '../../../application/interface/repository/conversation.repository.interface';

type CitationJson = Record<keyof MessageCitation, string>;

/**
 * Conversa por (tenant, usuário) no MySQL. As mensagens são append-only: o
 * `save` insere só as que vierem depois das já gravadas, na mesma transação do
 * `upsert` da conversa.
 */
@Injectable()
export class PrismaConversationRepository implements IConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(
    tenantId: string,
    userId: string,
    conversationId: string,
  ): Promise<ConversationEntity | null> {
    const row = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!row) return null;

    return ConversationEntity.create({
      conversationId: row.id,
      tenantId: row.tenantId,
      userId: row.userId,
      createdAt: row.createdAt,
      messages: row.messages.map((message) => this.toMessage(message)),
    });
  }

  async save(conversation: ConversationEntity): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.conversation.upsert({
        where: { id: conversation.conversationId },
        create: {
          id: conversation.conversationId,
          tenantId: conversation.tenantId,
          userId: conversation.userId,
          createdAt: conversation.createdAt,
        },
        update: { updatedAt: new Date() },
      });

      const persisted = await tx.conversationMessage.count({
        where: { conversationId: conversation.conversationId },
      });
      const pending = conversation.messages.slice(persisted);
      if (pending.length === 0) return;

      await tx.conversationMessage.createMany({
        data: pending.map((message) =>
          this.toCreateInput(conversation.conversationId, message),
        ),
      });
    });
  }

  private toCreateInput(
    conversationId: string,
    message: MessageEntity,
  ): Prisma.ConversationMessageCreateManyInput {
    return {
      conversationId,
      role: message.role,
      content: message.content,
      citations:
        message.citations.length > 0
          ? message.citations.map((citation) => this.toCitationJson(citation))
          : undefined,
      createdAt: message.createdAt,
    };
  }

  private toCitationJson(citation: MessageCitation): CitationJson {
    return {
      documentId: citation.documentId,
      chunkId: citation.chunkId,
      filename: citation.filename,
      excerpt: citation.excerpt,
    };
  }

  private toMessage(row: PrismaConversationMessage): MessageEntity {
    return MessageEntity.create({
      role: row.role,
      content: row.content,
      citations: this.toCitations(row.citations),
      createdAt: row.createdAt,
    });
  }

  /** Reidrata o JSON gravado; entradas fora do formato são descartadas. */
  private toCitations(value: Prisma.JsonValue): MessageCitation[] {
    if (!Array.isArray(value)) return [];
    return value.filter(isCitationJson).map((citation) => ({
      documentId: citation.documentId,
      chunkId: citation.chunkId,
      filename: citation.filename,
      excerpt: citation.excerpt,
    }));
  }
}

const CITATION_KEYS: (keyof MessageCitation)[] = [
  'documentId',
  'chunkId',
  'filename',
  'excerpt',
];

function isCitationJson(value: Prisma.JsonValue): value is CitationJson {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value;
  return CITATION_KEYS.every((key) => typeof record[key] === 'string');
}
