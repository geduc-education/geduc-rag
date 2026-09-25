import LlmProviderError from '../../../@core/shared/exceptions/502/llm-provider-error';
import { OllamaLlmProviderGateway } from '../infra/gateways/ollama-llm-provider.gateway';

const BASE_URL = 'http://localhost:11434';
const MODEL = 'qwen2.5:7b';
const TIMEOUT_MS = 120000;
const CONTEXT_WINDOW = 8192;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeSut(fetchFn: jest.Mock) {
  return new OllamaLlmProviderGateway(
    {
      baseUrl: BASE_URL,
      model: MODEL,
      timeoutMs: TIMEOUT_MS,
      contextWindowTokens: CONTEXT_WINDOW,
    },
    fetchFn as jest.MockedFunction<typeof fetch>,
  );
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('esperava rejeição');
}

const input = { prompt: 'Pergunta com contexto', maxOutputTokens: 512 };

describe('OllamaLlmProviderGateway', () => {
  it('envia POST /api/generate sem stream, com num_ctx, e mapeia texto e tokens', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        response: 'Resposta do modelo [1]',
        prompt_eval_count: 42,
        eval_count: 7,
      }),
    );

    const output = await makeSut(fetchFn).generate(input);

    expect(output).toEqual({
      text: 'Resposta do modelo [1]',
      inputTokens: 42,
      outputTokens: 7,
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/api/generate`);
    expect(init.method).toBe('POST');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body as string)).toEqual({
      model: MODEL,
      prompt: input.prompt,
      stream: false,
      options: { num_predict: 512, num_ctx: CONTEXT_WINDOW },
    });
  });

  it('conexão recusada vira LlmProviderError 502 com dica de ollama serve', async () => {
    const refused = new TypeError('fetch failed', {
      cause: Object.assign(new Error('connect ECONNREFUSED'), {
        code: 'ECONNREFUSED',
      }),
    });
    const fetchFn = jest.fn().mockRejectedValue(refused);

    const error = await captureError(makeSut(fetchFn).generate(input));

    expect(error).toBeInstanceOf(LlmProviderError);
    expect((error as LlmProviderError).getStatus()).toBe(502);
    expect((error as LlmProviderError).message).toBe(
      `Ollama indisponível em ${BASE_URL}. Verifique se o serviço está no ar (ollama serve).`,
    );
  });

  it.each(['AbortError', 'TimeoutError'])(
    '%s vira LlmProviderError 502 com o timeout',
    async (name) => {
      const fetchFn = jest
        .fn()
        .mockRejectedValue(new DOMException('aborted', name));

      const error = await captureError(makeSut(fetchFn).generate(input));

      expect(error).toBeInstanceOf(LlmProviderError);
      expect((error as LlmProviderError).getStatus()).toBe(502);
      expect((error as LlmProviderError).message).toBe(
        `Ollama não respondeu em ${TIMEOUT_MS} ms.`,
      );
    },
  );

  it('HTTP 404 vira LlmProviderError 502 com ollama pull do modelo', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(404, { error: `model '${MODEL}' not found` }),
      );

    const error = await captureError(makeSut(fetchFn).generate(input));

    expect(error).toBeInstanceOf(LlmProviderError);
    expect((error as LlmProviderError).getStatus()).toBe(502);
    expect((error as LlmProviderError).message).toBe(
      `Modelo ${MODEL} não encontrado no Ollama. Rode: ollama pull ${MODEL}`,
    );
  });

  it('outro status vira LlmProviderError 502 com status e corpo resumido', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(new Response('x'.repeat(500), { status: 500 }));

    const error = await captureError(makeSut(fetchFn).generate(input));

    expect(error).toBeInstanceOf(LlmProviderError);
    expect((error as LlmProviderError).getStatus()).toBe(502);
    const message = (error as LlmProviderError).message;
    expect(message.startsWith('Ollama respondeu 500: ')).toBe(true);
    expect(message.length).toBeLessThan(260);
  });
});
