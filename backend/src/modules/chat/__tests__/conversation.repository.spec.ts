import { ConversationRepository } from '../infra/database/repositories/conversation.repository';
import { ConversationEntity } from '../domain/entities/conversation.entity';
import {
  IDatabaseConnection,
  ITransactionalConnection,
  SqlParams,
} from '../../../@core/application/adapters/database-connection.interface';

interface SqlCall {
  method: string;
  sql: string;
  params: SqlParams;
  inTx: boolean;
}

interface FakeOptions {
  owned?: boolean;
  persisted?: number;
  conversationRow?: Record<string, unknown> | null;
  messageRows?: Record<string, unknown>[];
}

/**
 * Conexão falsa: registra todo SQL emitido (e se veio de dentro da
 * transação) e responde a posse, o `COUNT(*)` e o `findById` conforme as
 * opções.
 */
function makeConnection(options: FakeOptions = {}) {
  const calls: SqlCall[] = [];
  const owned = options.owned ?? true;

  const build = (inTx: boolean): ITransactionalConnection => {
    const record = (method: string, sql: string, params: SqlParams = []) =>
      calls.push({ method, sql, params, inTx });
    return {
      query: jest.fn((sql: string, params?: SqlParams) => {
        record('query', sql, params);
        return Promise.resolve(options.messageRows ?? []);
      }),
      queryOne: jest.fn((sql: string, params?: SqlParams) => {
        record('queryOne', sql, params);
        if (/COUNT\(\*\)/i.test(sql)) {
          return Promise.resolve({ total: options.persisted ?? 0 });
        }
        if (inTx) return Promise.resolve(owned ? { id: params?.[0] } : null);
        return Promise.resolve(options.conversationRow ?? null);
      }),
      insert: jest.fn((sql: string, params?: SqlParams) => {
        record('insert', sql, params);
        return Promise.resolve({ affectedRows: 1, insertId: 0 });
      }),
      update: jest.fn((sql: string, params?: SqlParams) => {
        record('update', sql, params);
        return Promise.resolve({ affectedRows: 1, insertId: 0 });
      }),
      delete: jest.fn((sql: string, params?: SqlParams) => {
        record('delete', sql, params);
        return Promise.resolve({ affectedRows: 1, insertId: 0 });
      }),
    };
  };

  const tx = build(true);
  const connection: IDatabaseConnection = {
    ...build(false),
    runInTransaction: jest.fn(
      <T>(work: (t: ITransactionalConnection) => Promise<T>) => work(tx),
    ),
  };
  return { connection, calls };
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

function makeConversation(): ConversationEntity {
  return ConversationEntity.create({
    conversationId: 'conv-1',
    tenantId: 'tenant-1',
    userId: 'user-1',
  });
}

const normalize = (sql: string) => sql.replace(/\s+/g, ' ').trim();

describe('ConversationRepository', () => {
  describe('save', () => {
    it('emite upsert, posse, COUNT(*) e um único INSERT com as 2 pendentes', async () => {
      const { connection, calls } = makeConnection({ persisted: 1 });
      const conversation = makeConversation();
      conversation.addMessage({ role: 'user', content: 'já gravada' });
      addTurn(conversation, 'segunda');

      await new ConversationRepository(connection).save(conversation);

      expect(connection.runInTransaction).toHaveBeenCalledTimes(1);
      expect(calls.every((c) => c.inTx)).toBe(true);
      const sqls = calls.map((c) => normalize(c.sql));

      expect(sqls[0]).toBe(
        'INSERT INTO conversation (id, tenant_id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(3)) ON DUPLICATE KEY UPDATE updated_at = NOW(3)',
      );
      expect(calls[0].params.slice(0, 3)).toEqual([
        'conv-1',
        'tenant-1',
        'user-1',
      ]);
      expect(calls[0].params[3]).toBeInstanceOf(Date);

      expect(sqls[1]).toBe(
        'SELECT id FROM conversation WHERE id = ? AND tenant_id = ? AND user_id = ?',
      );
      expect(calls[1].params).toEqual(['conv-1', 'tenant-1', 'user-1']);

      expect(sqls[2]).toMatch(/SELECT COUNT\(\*\)/);
      expect(sqls[2]).toContain('conversation_id = ?');

      const inserts = calls.filter((c) =>
        /INSERT INTO conversation_message/.test(c.sql),
      );
      expect(inserts).toHaveLength(1);
      expect(normalize(inserts[0].sql)).toBe(
        'INSERT INTO conversation_message (id, conversation_id, role, content, citations, created_at) VALUES ?',
      );
      const [rows] = inserts[0].params as [unknown[][]];
      expect(rows).toHaveLength(2);
      expect(rows[0].slice(1, 5)).toEqual(['conv-1', 'user', 'segunda', null]);
      expect(typeof rows[0][0]).toBe('string');
      expect(rows[0][5]).toBeInstanceOf(Date);
      expect(JSON.parse(rows[1][4] as string)).toEqual([
        {
          documentId: 'doc-1',
          chunkId: 'chunk-1',
          filename: 'manual.pdf',
          excerpt: 'trecho',
        },
      ]);
    });

    it('rejeita sem linha na checagem de posse e não insere mensagens', async () => {
      const { connection, calls } = makeConnection({ owned: false });
      const conversation = makeConversation();
      addTurn(conversation, 'primeira');

      await expect(
        new ConversationRepository(connection).save(conversation),
      ).rejects.toThrow();

      expect(
        calls.some((c) => /INSERT INTO conversation_message/.test(c.sql)),
      ).toBe(false);
      expect(calls.some((c) => /COUNT\(\*\)/.test(c.sql))).toBe(false);
    });

    it('não emite INSERT de mensagens quando não há pendente', async () => {
      const { connection, calls } = makeConnection({ persisted: 2 });
      const conversation = makeConversation();
      addTurn(conversation, 'primeira');

      await new ConversationRepository(connection).save(conversation);

      expect(
        calls.some((c) => /INSERT INTO conversation_message/.test(c.sql)),
      ).toBe(false);
    });
  });

  describe('findById', () => {
    it('devolve null quando a conversa não pertence ao par (tenant, usuário)', async () => {
      const { connection, calls } = makeConnection({ conversationRow: null });

      await expect(
        new ConversationRepository(connection).findById(
          'tenant-1',
          'user-2',
          'conv-1',
        ),
      ).resolves.toBeNull();
      expect(calls.every((c) => /tenant_id = \?/.test(c.sql))).toBe(true);
    });

    it('filtra todo SELECT por tenant_id, ordena por created_at e reidrata citações', async () => {
      const createdAt = new Date('2026-09-25T10:00:00Z');
      const { connection, calls } = makeConnection({
        conversationRow: {
          id: 'conv-1',
          tenant_id: 'tenant-1',
          user_id: 'user-1',
          created_at: createdAt,
        },
        messageRows: [
          {
            role: 'user',
            content: 'Qual o prazo?',
            citations: null,
            created_at: createdAt,
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
              { documentId: 'doc-2' },
            ],
            created_at: createdAt,
          },
        ],
      });

      const conversation = await new ConversationRepository(
        connection,
      ).findById('tenant-1', 'user-1', 'conv-1');

      expect(calls).toHaveLength(2);
      for (const call of calls) {
        expect(call.sql).toMatch(/WHERE[\s\S]*tenant_id = \?/);
        expect(call.params).toContain('tenant-1');
        expect(call.params).toContain('user-1');
      }
      expect(normalize(calls[1].sql)).toMatch(/ORDER BY \S*created_at ASC$/);

      expect(conversation?.conversationId).toBe('conv-1');
      expect(conversation?.userId).toBe('user-1');
      expect(conversation?.createdAt).toBe(createdAt);
      expect(conversation?.messages).toHaveLength(2);
      expect(conversation?.messages[0].citations).toEqual([]);
      expect(conversation?.messages[1].citations).toEqual([
        {
          documentId: 'doc-1',
          chunkId: 'chunk-1',
          filename: 'manual.pdf',
          excerpt: 'trecho',
        },
      ]);
    });
  });
});
