import { IConversationRepository } from './application/interface/repository/conversation.repository.interface';
import { IRetrievalContextGateway } from './application/interface/gateways/retrieval-context.gateway.interface';
import { IAnswerGenerationGateway } from './application/interface/gateways/answer-generation.gateway.interface';
import { InMemoryConversationRepository } from './infra/database/repositories/in-memory-conversation.repository';
import { RetrievalContextGateway } from './infra/gateways/retrieval-context.gateway';
import { AnswerGenerationGateway } from './infra/gateways/answer-generation.gateway';
import { RetrieveContextUseCase } from '../retrieval/application/usecase/retrieval/retrieve-context.usecase';
import { GenerateAnswerUseCase } from '../generation/application/usecase/generation/generate-answer.usecase';
import { SendMessageUseCase } from './application/usecase/chat/send-message.usecase';

export namespace CHAT_PROVIDERS {
  export namespace REPOSITORY {
    export const CONVERSATION_REPOSITORY = {
      provide: 'IConversationRepository',
      useClass: InMemoryConversationRepository,
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
