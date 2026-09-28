export const GITHUB_API_URL = 'https://api.github.com';

export interface GithubClientOptions {
  baseBranch: string;
  token?: string;
  timeoutMs: number;
}

export interface GithubMergedPull {
  number: number;
  title: string;
  url: string;
  mergedAt: string;
}

export type GithubErrorReason =
  | 'timeout'
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'http_error';

/**
 * Falha tipada do client do GitHub. A `message` é montada só com status e
 * motivo — nunca com headers ou URL autenticada —, então não carrega o token.
 */
export class GithubClientError extends Error {
  constructor(
    readonly reason: GithubErrorReason,
    readonly status: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'GithubClientError';
  }
}

interface GithubPullPayload {
  number: number;
  title: string;
  html_url: string;
  merged_at: string | null;
}

const STATUS_REASONS: Readonly<Record<number, GithubErrorReason>> = {
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  429: 'rate_limited',
};

const REASON_MESSAGES: Readonly<Record<GithubErrorReason, string>> = {
  timeout: 'GitHub não respondeu no tempo limite.',
  network: 'Falha de rede ao chamar o GitHub.',
  unauthorized: 'GitHub recusou a credencial (401).',
  forbidden: 'GitHub negou acesso ao repositório (403).',
  not_found: 'Repositório não encontrado no GitHub (404).',
  rate_limited: 'Limite de requisições do GitHub esgotado.',
  http_error: 'GitHub respondeu com erro HTTP.',
};

/**
 * Client REST dos PRs mergeados de um repositório (primeira página de 100 PRs
 * fechados na branch base). Sem `@Injectable()`: é instanciado por factory no
 * módulo. `fetchFn` é injetável para os testes nunca chamarem a rede.
 */
export class GithubPullsClient {
  constructor(
    private readonly options: GithubClientOptions,
    private readonly fetchFn: typeof fetch = globalThis.fetch,
  ) {}

  async listMergedPulls(repo: string): Promise<GithubMergedPull[]> {
    const response = await this.request(repo);
    if (!response.ok) {
      throw httpError(response);
    }
    const pulls = (await response.json()) as GithubPullPayload[];
    return pulls.filter(isMerged).map(toMergedPull);
  }

  private async request(repo: string): Promise<Response> {
    try {
      return await this.fetchFn(this.pullsUrl(repo), {
        method: 'GET',
        headers: this.headers(),
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch (error) {
      throw fetchError(error);
    }
  }

  private pullsUrl(repo: string): string {
    const base = encodeURIComponent(this.options.baseBranch);
    return `${GITHUB_API_URL}/repos/${repo}/pulls?state=closed&base=${base}&sort=updated&direction=desc&per_page=100`;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'geduc-rag',
    };
    const token = this.options.token?.trim();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }
}

function isMerged(
  pull: GithubPullPayload,
): pull is GithubPullPayload & { merged_at: string } {
  return pull.merged_at !== null;
}

function toMergedPull(
  pull: GithubPullPayload & { merged_at: string },
): GithubMergedPull {
  return {
    number: pull.number,
    title: pull.title,
    url: pull.html_url,
    mergedAt: pull.merged_at,
  };
}

function httpError(response: Response): GithubClientError {
  const reason = statusReason(response);
  return new GithubClientError(
    reason,
    response.status,
    `${REASON_MESSAGES[reason]} Status ${response.status}.`,
  );
}

function statusReason(response: Response): GithubErrorReason {
  const exhausted = response.headers.get('x-ratelimit-remaining') === '0';
  if (response.status === 403 && exhausted) return 'rate_limited';
  return STATUS_REASONS[response.status] ?? 'http_error';
}

function fetchError(error: unknown): GithubClientError {
  const reason: GithubErrorReason = isAbort(error) ? 'timeout' : 'network';
  return new GithubClientError(reason, null, REASON_MESSAGES[reason]);
}

function isAbort(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const name = (error as { name?: unknown }).name;
  return name === 'AbortError' || name === 'TimeoutError';
}
