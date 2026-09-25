import LlmProviderError from '../../../../@core/shared/exceptions/502/llm-provider-error';
import {
  ILlmProviderGateway,
  LlmGenerateInput,
  LlmGenerateOutput,
} from '../../application/interface/gateways/llm-provider.gateway.interface';

export interface OllamaLlmProviderConfig {
  baseUrl: string;
  model: string;
  timeoutMs: number;
  contextWindowTokens: number;
}

interface OllamaGenerateResponse {
  response?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

const BODY_SUMMARY_MAX_LENGTH = 200;

/**
 * Gateway real do LLM via Ollama (`POST /api/generate`, sem streaming). O
 * `num_ctx` é enviado sempre: sem ele o Ollama usa o contexto padrão e trunca
 * o prompt do RAG em silêncio. Nenhuma chamada acontece no boot.
 */
export class OllamaLlmProviderGateway implements ILlmProviderGateway {
  private readonly baseUrl: string;

  constructor(
    private readonly config: OllamaLlmProviderConfig,
    private readonly fetchFn: typeof fetch = globalThis.fetch,
  ) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
  }

  async generate(input: LlmGenerateInput): Promise<LlmGenerateOutput> {
    const response = await this.post(input);
    if (!response.ok) {
      throw await this.httpError(response);
    }
    const data = (await response.json()) as OllamaGenerateResponse;
    return {
      text: data.response ?? '',
      inputTokens: data.prompt_eval_count ?? 0,
      outputTokens: data.eval_count ?? 0,
    };
  }

  private async post(input: LlmGenerateInput): Promise<Response> {
    try {
      return await this.fetchFn(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          prompt: input.prompt,
          stream: false,
          options: {
            num_predict: input.maxOutputTokens,
            num_ctx: this.config.contextWindowTokens,
          },
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      throw this.networkError(error);
    }
  }

  private networkError(error: unknown): LlmProviderError {
    if (isAbort(error)) {
      return new LlmProviderError(
        `Ollama não respondeu em ${this.config.timeoutMs} ms.`,
      );
    }
    if (isConnectionRefused(error)) {
      return new LlmProviderError(
        `Ollama indisponível em ${this.baseUrl}. Verifique se o serviço está no ar (ollama serve).`,
      );
    }
    const reason = error instanceof Error ? error.message : String(error);
    return new LlmProviderError(`Falha ao chamar o Ollama: ${reason}`);
  }

  private async httpError(response: Response): Promise<LlmProviderError> {
    const { model } = this.config;
    if (response.status === 404) {
      return new LlmProviderError(
        `Modelo ${model} não encontrado no Ollama. Rode: ollama pull ${model}`,
      );
    }
    const body = await response.text().catch(() => '');
    return new LlmProviderError(
      `Ollama respondeu ${response.status}: ${summarize(body)}`,
    );
  }
}

function isAbort(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const name = (error as { name?: unknown }).name;
  return name === 'AbortError' || name === 'TimeoutError';
}

function isConnectionRefused(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const cause: unknown = error.cause;
  const code =
    typeof cause === 'object' && cause !== null && 'code' in cause
      ? cause.code
      : undefined;
  return code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED');
}

function summarize(body: string): string {
  const compact = body.replace(/\s+/g, ' ').trim();
  return compact.length > BODY_SUMMARY_MAX_LENGTH
    ? `${compact.slice(0, BODY_SUMMARY_MAX_LENGTH)}…`
    : compact;
}
