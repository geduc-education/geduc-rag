import { SendMessageUseCase } from '../application/usecase/chat/send-message.usecase';
import { IConversationRepository } from '../application/interface/repository/conversation.repository.interface';
import { IRetrievalContextGateway } from '../application/interface/gateways/retrieval-context.gateway.interface';
import { IAnswerGenerationGateway } from '../application/interface/gateways/answer-generation.gateway.interface';
import { ConversationEntity } from '../domain/entities/conversation.entity';

function makeRepository(): jest.Mocked<IConversationRepository> {
  return { findById: jest.fn().mockResolvedValue(null), save: jest.fn() };
}

function makeRetrievalGateway(): jest.Mocked<IRetrievalContextGateway> {
  return {
    retrieve: jest.fn().mockResolvedValue({
      contextChunks: [{ documentId: 'doc-1', content: 'trecho' }],
      citations: [
        { documentId: 'doc-1', chunkId: 'doc-1:0', excerpt: 'trecho' },
      ],
    }),
  };
}

function makeAnswerGateway(): jest.Mocked<IAnswerGenerationGateway> {
  return {
    generate: jest.fn().mockResolvedValue({
      answer: 'resposta',
      inputTokens: 10,
      outputTokens: 5,
    }),
  };
}

describe('SendMessageUseCase', () => {
  let repository: jest.Mocked<IConversationRepository>;
  let retrievalGateway: jest.Mocked<IRetrievalContextGateway>;
  let answerGateway: jest.Mocked<IAnswerGenerationGateway>;
  let sut: SendMessageUseCase;

  beforeEach(() => {
    repository = makeRepository();
    retrievalGateway = makeRetrievalGateway();
    answerGateway = makeAnswerGateway();
    sut = new SendMessageUseCase(repository, retrievalGateway, answerGateway);
  });

  describe('quando é o primeiro turno da conversa', () => {
    it('recupera contexto, gera a resposta e persiste o turno com citações', async () => {
      const result = await sut.execute({
        tenantId: 'tenant-1',
        question: 'Qual o prazo?',
      });

      expect(retrievalGateway.retrieve).toHaveBeenCalledWith(
        'tenant-1',
        'Qual o prazo?',
      );
      expect(answerGateway.generate).toHaveBeenCalledWith(
        expect.objectContaining({ question: 'Qual o prazo?', history: [] }),
      );
      expect(result.answer).toBe('resposta');
      expect(result.citations).toHaveLength(1);
      expect(repository.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('quando já existe uma conversa com turnos anteriores', () => {
    it('inclui o histórico anterior (sem a pergunta atual) no request de geração', async () => {
      const conversationId = 'conv-1';
      let saved: ConversationEntity | null = null;
      repository.findById.mockImplementation(() => Promise.resolve(saved));
      repository.save.mockImplementation((conversation) => {
        saved = conversation;
        return Promise.resolve();
      });

      await sut.execute({
        tenantId: 'tenant-1',
        conversationId,
        question: 'Primeira pergunta',
      });
      await sut.execute({
        tenantId: 'tenant-1',
        conversationId,
        question: 'Segunda pergunta',
      });

      const [, secondCallArgs] = answerGateway.generate.mock.calls;
      expect(secondCallArgs[0].history).toHaveLength(2);
      expect(secondCallArgs[0].history[0]).toMatchObject({
        role: 'user',
        content: 'Primeira pergunta',
      });
    });
  });
});
