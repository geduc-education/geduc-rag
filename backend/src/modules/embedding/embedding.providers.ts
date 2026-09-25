import { ConfigService } from '@nestjs/config';
import { VECTOR_STORE_CLIENT } from '../../@core/infra/vector-store/vector-store.module';
import { VectorStoreClient } from '../../@core/infra/vector-store/vector-store.client';
import { IEmbeddingProviderGateway } from './application/interface/gateways/embedding-provider.gateway.interface';
import { IVectorStoreGateway } from './application/interface/gateways/vector-store.gateway.interface';
import { EmbeddingProviderGateway } from './infra/gateways/embedding-provider.gateway';
import { LocalEmbeddingProviderGateway } from './infra/gateways/local-embedding-provider.gateway';
import { VectorStoreGateway } from './infra/gateways/vector-store.gateway';
import { EmbedTextUseCase } from './application/usecase/embedding/embed-text.usecase';
import { EmbedAndStoreChunkUseCase } from './application/usecase/embedding/embed-and-store-chunk.usecase';

/** Versão do espaço de embedding gerado — ver `.docs/architecture.md` (versionamento de embedding). */
const EMBEDDING_VERSION = 'v1';

export namespace EMBEDDING_PROVIDERS {
  export namespace GATEWAY {
    /** `EMBEDDING_PROVIDER=local` usa transformers.js; qualquer outro valor usa o mock. */
    export const EMBEDDING_PROVIDER_GATEWAY = {
      provide: 'IEmbeddingProviderGateway',
      useFactory: (config: ConfigService): IEmbeddingProviderGateway =>
        config.get<string>('EMBEDDING_PROVIDER') === 'local'
          ? new LocalEmbeddingProviderGateway({
              model: config.get<string>('EMBEDDING_MODEL')!,
              queryPrefix: config.get<string>('EMBEDDING_QUERY_PREFIX')!,
              passagePrefix: config.get<string>('EMBEDDING_PASSAGE_PREFIX')!,
              cacheDir: config.get<string>('EMBEDDING_CACHE_DIR'),
            })
          : new EmbeddingProviderGateway(config),
      inject: [ConfigService],
    };

    export const VECTOR_STORE_GATEWAY = {
      provide: 'IVectorStoreGateway',
      useFactory: (client: VectorStoreClient) => new VectorStoreGateway(client),
      inject: [VECTOR_STORE_CLIENT],
    };
  }

  export namespace USE_CASES {
    export const EMBED_TEXT = {
      provide: EmbedTextUseCase,
      useFactory: (gateway: IEmbeddingProviderGateway, config: ConfigService) =>
        new EmbedTextUseCase(
          gateway,
          config.get<number>('EMBEDDING_DIMENSIONS')!,
        ),
      inject: [GATEWAY.EMBEDDING_PROVIDER_GATEWAY.provide, ConfigService],
    };

    export const EMBED_AND_STORE_CHUNK = {
      provide: EmbedAndStoreChunkUseCase,
      useFactory: (
        embedText: EmbedTextUseCase,
        vectorStoreGateway: IVectorStoreGateway,
        config: ConfigService,
      ) =>
        new EmbedAndStoreChunkUseCase(
          embedText,
          vectorStoreGateway,
          config.get<string>('EMBEDDING_MODEL')!,
          EMBEDDING_VERSION,
        ),
      inject: [
        EMBED_TEXT.provide,
        GATEWAY.VECTOR_STORE_GATEWAY.provide,
        ConfigService,
      ],
    };
  }
}
