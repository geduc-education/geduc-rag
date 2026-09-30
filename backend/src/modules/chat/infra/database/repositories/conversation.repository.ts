import { randomUUID } from 'node:crypto';
import {
  IDatabaseConnection,
  ITransactionalConnection,
} from '../../../../../@core/application/adapters/database-connection.interface';
import { ConversationEntity } from '../../../domain/entities/conversation.entity';
import {
  MessageCitation,
  MessageEntity,
} from '../../../domain/entities/message.entity';
import { IConversationRepository } from '../../../application/interface/repository/conversation.repository.interface';

type MessageRole = 'user' | 'assistant';

interface ConversationRow {
  id: string;
  tenant_id: string;
  user_id: string;
  created_at: Date;
}

interface MessageRow {
  role: MessageRole;
  content: string;
  citations: unknown;
  created_at: Date;
}

const UPSERT_CONVERSATION = `
  INSERT INTO conversation (id, tenant_id, user_id, created_at, updated_at)
  VALUES (?, ?, ?, ?, NOW(3))
  ON DUPLICATE KEY UPDATE updated_at = NOW(3)`;

const SELECT_OWNED_ID = `
  SELECT id FROM conversation
  WHERE id = ? AND tenant_id = ? AND user_id = ?`;

const SELECT_CONVERSATION = `
  SELECT id, tenant_id, user_id, created_at FROM conversation
  WHERE id = ? AND tenant_id = ? AND user_id = ?`;

const SELECT_MESSAGES = `
  SELECT m.role, m.content, m.citations, m.created_at
  FROM conversation_message m
  INNER JOIN conversation c ON c.id = m.conversation_id
  WHERE m.conversation_id = ? AND c.tenant_id = ? AND c.user_id = ?
  ORDER BY m.created_at ASC`;

const COUNT_MESSAGES = `
  SELECT COUNT(*) AS total FROM conversation_message
  WHERE conversation_id = ?`;

const INSERT_MESSAGES = `
  INSERT INTO conversation_message
    (id, conversation_id, role, content, citations, created_at)
  VALUES ?`;

const CITATION_KEYS: (keyof MessageCitation)[] = [
  'documentId',
  'chunkId',
  'filename',
  'excerpt',
];

/**
 * Conversa por (tenant, usuário) no MySQL. As mensagens são append-only: o
 * `save` insere só as que vierem depois das já gravadas, na mesma transação do
 * upsert da conversa. Se o id já pertencer a outro par (tenant, usuário), a
 * checagem de posse lança e a transação faz rollback.
 */
export class ConversationRepository implements IConversationRepository {
  constructor(private readonly connection: IDatabaseConnection) {}

  async findById(
    tenantId: string,
    userId: string,
    conversationId: string,
  ): Promise<ConversationEntity | null> {
    const scope = [conversationId, tenantId, userId];
    const row = await this.connection.queryOne<ConversationRow>(
      SELECT_CONVERSATION,
      scope,
    );
    if (!row) return null;

    const messages = await this.connection.query<MessageRow>(
      SELECT_MESSAGES,
      scope,
    );
    return ConversationEntity.create({
      conversationId: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      createdAt: row.created_at,
      messages: messages.map(toMessage),
    });
  }

  async save(conversation: ConversationEntity): Promise<void> {
    await this.connection.runInTransaction(async (tx) => {
      await upsertOwned(tx, conversation);
      const persisted = await countMessages(tx, conversation.conversationId);
      const pending = conversation.messages.slice(persisted);
      if (pending.length === 0) return;

      await tx.insert(INSERT_MESSAGES, [
        pending.map((message) =>
          toMessageValues(conversation.conversationId, message),
        ),
      ]);
    });
  }
}

async function upsertOwned(
  tx: ITransactionalConnection,
  conversation: ConversationEntity,
): Promise<void> {
  const { conversationId, tenantId, userId, createdAt } = conversation;
  await tx.insert(UPSERT_CONVERSATION, [
    conversationId,
    tenantId,
    userId,
    createdAt,
  ]);
  const owned = await tx.queryOne(SELECT_OWNED_ID, [
    conversationId,
    tenantId,
    userId,
  ]);
  if (!owned) {
    throw new Error(
      `Conversa ${conversationId} não pertence ao par (tenant, usuário)`,
    );
  }
}

async function countMessages(
  tx: ITransactionalConnection,
  conversationId: string,
): Promise<number> {
  const row = await tx.queryOne<{ total: number | string }>(COUNT_MESSAGES, [
    conversationId,
  ]);
  return Number(row?.total ?? 0);
}

function toMessageValues(
  conversationId: string,
  message: MessageEntity,
): unknown[] {
  const citations =
    message.citations.length > 0
      ? JSON.stringify(message.citations.map(toCitationJson))
      : null;
  return [
    randomUUID(),
    conversationId,
    message.role,
    message.content,
    citations,
    message.createdAt,
  ];
}

function toCitationJson(citation: MessageCitation): MessageCitation {
  return {
    documentId: citation.documentId,
    chunkId: citation.chunkId,
    filename: citation.filename,
    excerpt: citation.excerpt,
  };
}

function toMessage(row: MessageRow): MessageEntity {
  return MessageEntity.create({
    role: row.role,
    content: row.content,
    citations: toCitations(row.citations),
    createdAt: row.created_at,
  });
}

/** Reidrata o JSON gravado (já parseado pelo mysql2); entradas fora do formato são descartadas. */
function toCitations(value: unknown): MessageCitation[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isCitationJson).map(toCitationJson);
}

function isCitationJson(value: unknown): value is MessageCitation {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return CITATION_KEYS.every((key) => typeof record[key] === 'string');
}
