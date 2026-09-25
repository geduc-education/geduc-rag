import { ConversationEntity } from '../domain/entities/conversation.entity';

describe('ConversationEntity', () => {
  describe('historyBefore', () => {
    it('exclui apenas a mensagem corrente, mantendo os turnos anteriores', () => {
      const conversation = ConversationEntity.create({
        conversationId: 'conv-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
      });
      conversation.addMessage({ role: 'user', content: 'Oi' });
      conversation.addMessage({ role: 'assistant', content: 'Olá!' });
      const current = conversation.addMessage({
        role: 'user',
        content: 'Qual o prazo?',
      });

      const history = conversation.historyBefore(current);

      expect(history).toHaveLength(2);
      expect(history.map((m) => m.content)).toEqual(['Oi', 'Olá!']);
    });
  });

  describe('create', () => {
    it('guarda o userId dono da conversa', () => {
      const conversation = ConversationEntity.create({
        conversationId: 'conv-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
      });

      expect(conversation.userId).toBe('user-1');
    });
  });
});
