import { ConfigService } from '@nestjs/config';
import EmbeddingProviderError from '../../../@core/shared/exceptions/502/embedding-provider-error';
import { EMBEDDING_PROVIDERS } from '../embedding.providers';
import { EmbeddingProviderGateway } from '../infra/gateways/embedding-provider.gateway';
import {
  FeatureExtractor,
  FeatureExtractorLoader,
  LocalEmbeddingProviderGateway,
} from '../infra/gateways/local-embedding-provider.gateway';

// Guarda: o spec nunca pode carregar o pacote ESM real (nem baixar o modelo).
jest.mock('@huggingface/transformers', () => {
  throw new Error('@huggingface/transformers não pode ser importado no spec');
});

const MODEL = 'Xenova/multilingual-e5-small';

const OPTIONS = {
  model: MODEL,
  queryPrefix: 'query: ',
  passagePrefix: 'passage: ',
  cacheDir: '/tmp/cache-embedding',
};

function makeExtractor(
  vector: number[] = [0.1, 0.2, 0.3],
): jest.MockedFunction<FeatureExtractor> {
  return jest.fn().mockResolvedValue({ data: Float32Array.from(vector) });
}

function makeLoader(
  extractor: FeatureExtractor,
): jest.MockedFunction<FeatureExtractorLoader> {
  return jest.fn().mockResolvedValue(extractor);
}

describe('LocalEmbeddingProviderGateway', () => {
  it('prefixa "query: " e chama o pipeline com mean pooling normalizado', async () => {
    const extractor = makeExtractor([0.5, 0.25]);
    const sut = new LocalEmbeddingProviderGateway(
      OPTIONS,
      makeLoader(extractor),
    );

    const vector = await sut.embed('x', 'query');

    expect(extractor).toHaveBeenCalledWith('query: x', {
      pooling: 'mean',
      normalize: true,
    });
    expect(vector).toEqual([0.5, 0.25]);
    expect(Array.isArray(vector)).toBe(true);
  });

  it('prefixa "passage: " para chunks de documento', async () => {
    const extractor = makeExtractor();
    const sut = new LocalEmbeddingProviderGateway(
      OPTIONS,
      makeLoader(extractor),
    );

    await sut.embed('x', 'passage');

    expect(extractor).toHaveBeenCalledWith('passage: x', {
      pooling: 'mean',
      normalize: true,
    });
  });

  it('carrega o modelo uma vez só, repassando modelo e cacheDir', async () => {
    const loader = makeLoader(makeExtractor());
    const sut = new LocalEmbeddingProviderGateway(OPTIONS, loader);

    await sut.embed('a', 'query');
    await sut.embed('b', 'passage');

    expect(loader).toHaveBeenCalledTimes(1);
    expect(loader).toHaveBeenCalledWith(MODEL, '/tmp/cache-embedding');
  });

  it('chamadas concorrentes compartilham a mesma carga', async () => {
    const loader = makeLoader(makeExtractor());
    const sut = new LocalEmbeddingProviderGateway(OPTIONS, loader);

    await Promise.all([sut.embed('a', 'query'), sut.embed('b', 'query')]);

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('não carrega o modelo na construção (lazy)', () => {
    const loader = makeLoader(makeExtractor());

    new LocalEmbeddingProviderGateway(OPTIONS, loader);

    expect(loader).not.toHaveBeenCalled();
  });

  it('falha de carga vira EmbeddingProviderError 502 com o nome do modelo', async () => {
    const loader: jest.MockedFunction<FeatureExtractorLoader> = jest
      .fn()
      .mockRejectedValue(new Error('sem rede'));
    const sut = new LocalEmbeddingProviderGateway(OPTIONS, loader);

    const error = await sut.embed('x', 'query').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(EmbeddingProviderError);
    expect((error as EmbeddingProviderError).getStatus()).toBe(502);
    expect((error as EmbeddingProviderError).message).toBe(
      `Falha ao carregar o modelo de embedding ${MODEL}: sem rede`,
    );
  });

  it('falha de carga não fica em cache: a próxima chamada tenta de novo', async () => {
    const extractor = makeExtractor();
    const loader: jest.MockedFunction<FeatureExtractorLoader> = jest
      .fn()
      .mockRejectedValueOnce(new Error('sem rede'))
      .mockResolvedValueOnce(extractor);
    const sut = new LocalEmbeddingProviderGateway(OPTIONS, loader);

    await expect(sut.embed('x', 'query')).rejects.toBeInstanceOf(
      EmbeddingProviderError,
    );
    await expect(sut.embed('x', 'query')).resolves.toEqual([
      expect.closeTo(0.1),
      expect.closeTo(0.2),
      expect.closeTo(0.3),
    ]);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('falha de inferência vira EmbeddingProviderError com o nome do modelo', async () => {
    const extractor: jest.MockedFunction<FeatureExtractor> = jest
      .fn()
      .mockRejectedValue(new Error('onnx quebrou'));
    const sut = new LocalEmbeddingProviderGateway(
      OPTIONS,
      makeLoader(extractor),
    );

    const error = await sut.embed('x', 'passage').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(EmbeddingProviderError);
    expect((error as EmbeddingProviderError).getStatus()).toBe(502);
    expect((error as EmbeddingProviderError).message).toContain(MODEL);
    expect((error as EmbeddingProviderError).message).toContain('onnx quebrou');
  });
});

describe('EMBEDDING_PROVIDERS.GATEWAY.EMBEDDING_PROVIDER_GATEWAY', () => {
  function makeConfig(values: Record<string, unknown>): ConfigService {
    return {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
  }

  const provider = EMBEDDING_PROVIDERS.GATEWAY.EMBEDDING_PROVIDER_GATEWAY;

  it('usa o gateway local quando EMBEDDING_PROVIDER=local', () => {
    const gateway = provider.useFactory(
      makeConfig({
        EMBEDDING_PROVIDER: 'local',
        EMBEDDING_MODEL: MODEL,
        EMBEDDING_QUERY_PREFIX: 'query: ',
        EMBEDDING_PASSAGE_PREFIX: 'passage: ',
      }),
    );

    expect(gateway).toBeInstanceOf(LocalEmbeddingProviderGateway);
  });

  it('usa o mock nos demais casos', () => {
    const gateway = provider.useFactory(
      makeConfig({ EMBEDDING_PROVIDER: 'mock', EMBEDDING_DIMENSIONS: 4 }),
    );

    expect(gateway).toBeInstanceOf(EmbeddingProviderGateway);
  });
});
