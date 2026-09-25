import EmbeddingProviderError from '../../../../@core/shared/exceptions/502/embedding-provider-error';
import {
  EmbeddingKind,
  IEmbeddingProviderGateway,
} from '../../application/interface/gateways/embedding-provider.gateway.interface';

/** Opções de inferência repassadas ao pipeline `feature-extraction`. */
export interface FeatureExtractionOptions {
  pooling: 'mean';
  normalize: boolean;
}

/** Recorte mínimo do pipeline `feature-extraction` do transformers.js usado aqui. */
export type FeatureExtractor = (
  text: string,
  options: FeatureExtractionOptions,
) => Promise<{ data: ArrayLike<number> }>;

/** Carrega o pipeline do modelo. Injetável para que os testes nunca importem o pacote ESM. */
export type FeatureExtractorLoader = (
  model: string,
  cacheDir?: string,
) => Promise<FeatureExtractor>;

export interface LocalEmbeddingOptions {
  model: string;
  queryPrefix: string;
  passagePrefix: string;
  cacheDir?: string;
}

const EXTRACTION_OPTIONS: FeatureExtractionOptions = {
  pooling: 'mean',
  normalize: true,
};

/**
 * Loader padrão: `import()` dinâmico (preservado em CJS pelo `module: nodenext`), então o
 * pacote só é carregado — e o modelo só é baixado — na primeira chamada de `embed`.
 */
export const transformersFeatureExtractorLoader: FeatureExtractorLoader =
  async (model, cacheDir) => {
    const { pipeline } = await import('@huggingface/transformers');
    const extractor = await pipeline('feature-extraction', model, {
      cache_dir: cacheDir,
    });
    return async (text, options) => {
      const tensor = await extractor(text, options);
      // `DataArray` inclui BigInt64Array; feature-extraction produz float32, mas o
      // `Number` garante `number[]` sem cast inseguro.
      return {
        data: Array.from(tensor.data as ArrayLike<number | bigint>, Number),
      };
    };
  };

/**
 * Embeddings locais no Node via transformers.js (ex.: `Xenova/multilingual-e5-small`).
 * O pipeline é carregado lazy e reaproveitado; chamadas concorrentes compartilham a mesma
 * promise de carga. Modelos assimétricos (e5) recebem o prefixo conforme o `kind`.
 */
export class LocalEmbeddingProviderGateway implements IEmbeddingProviderGateway {
  private extractor?: Promise<FeatureExtractor>;

  constructor(
    private readonly options: LocalEmbeddingOptions,
    private readonly loader: FeatureExtractorLoader = transformersFeatureExtractorLoader,
  ) {}

  async embed(text: string, kind: EmbeddingKind): Promise<number[]> {
    try {
      const extractor = await this.loadExtractor();
      const output = await extractor(
        this.prefix(kind) + text,
        EXTRACTION_OPTIONS,
      );
      return Array.from(output.data);
    } catch (error) {
      throw this.toProviderError(error);
    }
  }

  private loadExtractor(): Promise<FeatureExtractor> {
    if (!this.extractor) {
      this.extractor = this.loader(this.options.model, this.options.cacheDir);
      // Falha de carga não fica em cache: a próxima chamada tenta de novo.
      this.extractor.catch(() => {
        this.extractor = undefined;
      });
    }
    return this.extractor;
  }

  private prefix(kind: EmbeddingKind): string {
    return kind === 'query'
      ? this.options.queryPrefix
      : this.options.passagePrefix;
  }

  private toProviderError(error: unknown): EmbeddingProviderError {
    const cause = error instanceof Error ? error.message : String(error);
    return new EmbeddingProviderError(
      `Falha ao carregar o modelo de embedding ${this.options.model}: ${cause}`,
    );
  }
}
