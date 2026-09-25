import { PrismaConversationRepository } from '../infra/database/repositories/prisma-conversation.repository';
import { ConversationEntity } from '../domain/entities/conversation.entity';
import { PrismaService } from '../../../database/prisma.service';

interface CreatedMessage {
  conversationId: string;
  role: string;
  content: string;
  citations?: unknown;
  createdAt: Date;
}

/**
 * `PrismaService` mockado com estado mínimo: `count` reflete o que o
 * `createMany` já gravou, como o banco faria dentro da transação.
 */
function makePrisma() {
  const persisted: CreatedMessage[] = [];
  const tx = {
    conversation: { upsert: jest.fn().mockResolvedValue({}) },
    conversationMessage: {
      count: jest.fn(({ where }: { where: { conversationId: string } }) =>
        Promise.resolve(
          persisted.filter((m) => m.conversationId === where.conversationId)
            .length,
        ),
      ),
      createMany: jest.fn(({ data }: { data: CreatedMessage[] }) => {
        persisted.push(...data);
        return Promise.resolve({ count: data.length });
      }),
    },
  };
  const prisma = {
    conversation: { findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  };
  return { prisma, tx };
}

function addTurn(conversation: ConversationEntity, question: string): void {
  conversation.addMessage({ role: 'user', content: question });
  conversation.addMessage({
    role: 'assistant',
    content: `resposta para ${question}`,
    citations: [
      {
        documentId: 'doc-1',
        chunkId: 'chunk-1',
        filename: 'manual.pdf',
        excerpt: 'trecho',
      },
    ],
  });
}

describe('PrismaConversationRepository', () => {
  let mocks: ReturnType<typeof makePrisma>;
  let sut: PrismaConversationRepository;

  beforeEach(() => {
    mocks = makePrisma();
    sut = new PrismaConversationRepository(mocks.prisma);
  });

  describe('findById', () => {
    it('filtra por id, tenantId e userId e ordena as mensagens por createdAt asc', async () => {
      await sut.findById('tenant-1', 'user-1', 'conv-1');

      expect(mocks.prisma.conversation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conv-1', tenantId: 'tenant-1', userId: 'user-1' },
          include: { messages: { orderBy: { createdAt: 'asc' } } },
        }),
      );
    });

    it('devolve null quando a conversa não pertence ao par (tenant, usuário)', async () => {
      await expect(
        sut.findById('tenant-1', 'user-2', 'conv-1'),
      ).resolves.toBeNull();
    });

    it('reidrata a conversa com mensagens e citações (incluindo filename)', async () => {
      const createdAt = new Date('2026-09-25T10:00:00Z');
      mocks.prisma.conversation.findFirst.mockResolvedValue({
        id: 'conv-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        createdAt,
        messages: [
          {
            role: 'user',
            content: 'Qual o prazo?',
            citations: null,
            createdAt,
          },
          {
            role: 'assistant',
            content: 'Dez dias.',
            citations: [
              {
                documentId: 'doc-1',
                chunkId: 'chunk-1',
                filename: 'manual.pdf',
                excerpt: 'trecho',
              },
            ],
            createdAt,
          },
        ],
      });

      const conversation = await sut.findById('tenant-1', 'user-1', 'conv-1');

      expect(conversation?.conversationId).toBe('conv-1');
      expect(conversation?.userId).toBe('user-1');
      expect(conversation?.messages).toHaveLength(2);
      expect(conversation?.messages[0].citations).toEqual([]);
      expect(conversation?.messages[1].citations[0]).toEqual({
        documentId: 'doc-1',
        chunkId: 'chunk-1',
        filename: 'manual.pdf',
        excerpt: 'trecho',
      });
    });
  });

  describe('save', () => {
    it('faz upsert da conversa dentro de $transaction', async () => {
      const conversation = ConversationEntity.create({
        conversationId: 'conv-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
      });
      addTurn(conversation, 'primeira');

      await sut.save(conversation);

      expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mocks.tx.conversation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conv-1' },
          create: expect.objectContaining({
            id: 'conv-1',
            tenantId: 'tenant-1',
            userId: 'user-1',
          }),
        }),
      );
    });

    it('é append-only: o segundo save grava só as 2 mensagens novas', async () => {
      const conversation = ConversationEntity.create({
        conversationId: 'conv-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
      });

      addTurn(conversation, 'primeira');
      await sut.save(conversation);
      addTurn(conversation, 'segunda');
      await sut.save(conversation);

      const calls = mocks.tx.conversationMessage.createMany.mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0][0].data).toHaveLength(2);
      expect(calls[1][0].data).toHaveLength(2);
      expect(calls[1][0].data.map((m) => m.content)).toEqual([
        'segunda',
        'resposta para segunda',
      ]);
    });

    it('grava as citações em JSON com filename', async () => {
      const conversation = ConversationEntity.create({
        conversationId: 'conv-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
      });
      addTurn(conversation, 'primeira');

      await sut.save(conversation);

      const [[{ data }]] = mocks.tx.conversationMessage.createMany.mock.calls;
      expect(data[0]).toMatchObject({
        conversationId: 'conv-1',
        role: 'user',
        content: 'primeira',
      });
      expect(data[1].citations).toEqual([
        {
          documentId: 'doc-1',
          chunkId: 'chunk-1',
          filename: 'manual.pdf',
          excerpt: 'trecho',
        },
      ]);
    });

    it('não chama createMany quando não há mensagem nova', async () => {
      const conversation = ConversationEntity.create({
        conversationId: 'conv-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
      });
      addTurn(conversation, 'primeira');

      await sut.save(conversation);
      await sut.save(conversation);

      expect(mocks.tx.conversationMessage.createMany).toHaveBeenCalledTimes(1);
    });
  });
});
