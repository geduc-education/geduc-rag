import { IConversationRepository } from './application/interface/repository/conversation.repository.interface';
import { IRetrievalContextGateway } from './application/interface/gateways/retrieval-context.gateway.interface';
import { IAnswerGenerationGateway } from './application/interface/gateways/answer-generation.gateway.interface';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { InMemoryConversationRepository } from './infra/database/repositories/in-memory-conversation.repository';
import { PrismaConversationRepository } from './infra/database/repositories/prisma-conversation.repository';
import { RetrievalContextGateway } from './infra/gateways/retrieval-context.gateway';
import { AnswerGenerationGateway } from './infra/gateways/answer-generation.gateway';
import { RetrieveContextUseCase } from '../retrieval/application/usecase/retrieval/retrieve-context.usecase';
import { GenerateAnswerUseCase } from '../generation/application/usecase/generation/generate-answer.usecase';
import { SendMessageUseCase } from './application/usecase/chat/send-message.usecase';

export namespace CHAT_PROVIDERS {
  export namespace REPOSITORY {
    /** `RAG_STORAGE=memory` mantém o adapter in-memory (e2e e dev sem banco). */
    export const CONVERSATION_REPOSITORY = {
      provide: 'IConversationRepository',
      useFactory: (
        config: ConfigService,
        prisma: PrismaService,
      ): IConversationRepository =>
        config.get<string>('RAG_STORAGE') === 'memory'
          ? new InMemoryConversationRepository()
          : new PrismaConversationRepository(prisma),
      inject: [ConfigService, PrismaService],
    };
  }

  export namespace GATEWAY {
    export const RETRIEVAL_CONTEXT_GATEWAY = {
      provide: 'IRetrievalContextGateway',
      useFactory: (useCase: RetrieveContextUseCase) =>
        new RetrievalContextGateway(useCase),
      inject: [RetrieveContextUseCase],
    };

    export const ANSWER_GENERATION_GATEWAY = {
      provide: 'IAnswerGenerationGateway',
      useFactory: (useCase: GenerateAnswerUseCase) =>
        new AnswerGenerationGateway(useCase),
      inject: [GenerateAnswerUseCase],
    };
  }

  export namespace USE_CASES {
    export const SEND_MESSAGE = {
      provide: SendMessageUseCase,
      useFactory: (
        repository: IConversationRepository,
        retrievalContextGateway: IRetrievalContextGateway,
        answerGenerationGateway: IAnswerGenerationGateway,
      ) =>
        new SendMessageUseCase(
          repository,
          retrievalContextGateway,
          answerGenerationGateway,
        ),
      inject: [
        REPOSITORY.CONVERSATION_REPOSITORY.provide,
        GATEWAY.RETRIEVAL_CONTEXT_GATEWAY.provide,
        GATEWAY.ANSWER_GENERATION_GATEWAY.provide,
      ],
    };
  }
}
