import {
  GithubClientError,
  GithubClientOptions,
  GithubPullsClient,
} from '../github-pulls.client';

const REPO = 'owner/nome';
const TOKEN = 'ghp_secreto';
const EXPECTED_URL =
  'https://api.github.com/repos/owner/nome/pulls?state=closed&base=main&sort=updated&direction=desc&per_page=100';

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function makeSut(
  fetchFn: jest.Mock,
  options: Partial<GithubClientOptions> = {},
) {
  return new GithubPullsClient(
    { baseBranch: 'main', timeoutMs: 5000, ...options },
    fetchFn as jest.MockedFunction<typeof fetch>,
  );
}

async function captureError(
  promise: Promise<unknown>,
): Promise<GithubClientError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof GithubClientError) return error;
    throw error;
  }
  throw new Error('esperava rejeição');
}

function requestHeaders(fetchFn: jest.Mock): Headers {
  const init = fetchFn.mock.calls[0][1] as RequestInit;
  return new Headers(init.headers);
}

const mergedPull = {
  number: 42,
  title: 'feat: nova tela',
  html_url: 'https://github.com/owner/nome/pull/42',
  merged_at: '2026-09-20T10:00:00Z',
};
const closedPull = {
  number: 43,
  title: 'fix: descartado',
  html_url: 'https://github.com/owner/nome/pull/43',
  merged_at: null,
};

describe('GithubPullsClient', () => {
  it('chama a API REST de pulls com base fixa, headers e timeout', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse(200, []));

    await makeSut(fetchFn).listMergedPulls(REPO);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][0]).toBe(EXPECTED_URL);
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const headers = requestHeaders(fetchFn);
    expect(headers.get('Accept')).toBe('application/vnd.github+json');
    expect(headers.get('X-GitHub-Api-Version')).toBe('2022-11-28');
    expect(headers.get('User-Agent')).toBe('geduc-rag');
  });

  it('codifica a branch base na URL', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse(200, []));

    await makeSut(fetchFn, { baseBranch: 'release/1.0' }).listMergedPulls(REPO);

    expect(fetchFn.mock.calls[0][0]).toContain('base=release%2F1.0&');
  });

  it('envia Authorization Bearer quando há token', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse(200, []));

    await makeSut(fetchFn, { token: TOKEN }).listMergedPulls(REPO);

    expect(requestHeaders(fetchFn).get('Authorization')).toBe(
      `Bearer ${TOKEN}`,
    );
  });

  it('não envia Authorization sem token ou com token vazio', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse(200, []));

    await makeSut(fetchFn).listMergedPulls(REPO);
    await makeSut(fetchFn, { token: '' }).listMergedPulls(REPO);

    expect(requestHeaders(fetchFn).has('Authorization')).toBe(false);
    const second = new Headers(
      (fetchFn.mock.calls[1][1] as RequestInit).headers,
    );
    expect(second.has('Authorization')).toBe(false);
  });

  it('devolve só os PRs mergeados, com url vinda de html_url', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(jsonResponse(200, [mergedPull, closedPull]));

    const pulls = await makeSut(fetchFn).listMergedPulls(REPO);

    expect(pulls).toEqual([
      {
        number: 42,
        title: 'feat: nova tela',
        url: 'https://github.com/owner/nome/pull/42',
        mergedAt: '2026-09-20T10:00:00Z',
      },
    ]);
  });

  it('401 rejeita com unauthorized sem vazar o token', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(jsonResponse(401, { message: 'Bad credentials' }));

    const error = await captureError(
      makeSut(fetchFn, { token: TOKEN }).listMergedPulls(REPO),
    );

    expect(error.reason).toBe('unauthorized');
    expect(error.status).toBe(401);
    expect(error.message).not.toContain(TOKEN);
    expect(JSON.stringify(error)).not.toContain(TOKEN);
  });

  it('403 com x-ratelimit-remaining 0 rejeita com rate_limited', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(403, {}, { 'x-ratelimit-remaining': '0' }),
      );

    const error = await captureError(makeSut(fetchFn).listMergedPulls(REPO));

    expect(error.reason).toBe('rate_limited');
    expect(error.status).toBe(403);
  });

  it('403 sem limite esgotado rejeita com forbidden', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse(403, {}));

    const error = await captureError(makeSut(fetchFn).listMergedPulls(REPO));

    expect(error.reason).toBe('forbidden');
  });

  it('429 rejeita com rate_limited', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse(429, {}));

    const error = await captureError(makeSut(fetchFn).listMergedPulls(REPO));

    expect(error.reason).toBe('rate_limited');
  });

  it('404 rejeita com not_found', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse(404, {}));

    const error = await captureError(makeSut(fetchFn).listMergedPulls(REPO));

    expect(error.reason).toBe('not_found');
    expect(error.status).toBe(404);
  });

  it('outro status não-2xx rejeita com http_error', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse(500, {}));

    const error = await captureError(makeSut(fetchFn).listMergedPulls(REPO));

    expect(error.reason).toBe('http_error');
    expect(error.status).toBe(500);
  });

  it('abort por timeout rejeita com timeout e status null', async () => {
    const abort = new Error('The operation was aborted due to timeout');
    abort.name = 'TimeoutError';
    const fetchFn = jest.fn().mockRejectedValue(abort);

    const error = await captureError(makeSut(fetchFn).listMergedPulls(REPO));

    expect(error.reason).toBe('timeout');
    expect(error.status).toBeNull();
  });

  it('exceção do fetch rejeita com network e status null', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new TypeError('fetch failed'));

    const error = await captureError(
      makeSut(fetchFn, { token: TOKEN }).listMergedPulls(REPO),
    );

    expect(error.reason).toBe('network');
    expect(error.status).toBeNull();
    expect(error.message).not.toContain(TOKEN);
  });
});
