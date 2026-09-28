import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ERROR_CODES } from '../../common/errors/error-codes';
import { parseConventionalTitle } from './changelog-title.parser';
import { ChangelogFeed, ChangelogItem } from './changelog.types';
import {
  GithubClientError,
  GithubErrorReason,
  GithubMergedPull,
  GithubPullsClient,
} from './github-pulls.client';

interface CacheEntry {
  items: ChangelogItem[];
  /** Epoch em ms da busca bem-sucedida. */
  fetchedAt: number;
}

interface ResolvedEntry {
  entry: CacheEntry;
  stale: boolean;
}

const SOURCE_MESSAGES: Readonly<Record<GithubErrorReason, string>> = {
  timeout: 'O GitHub não respondeu a tempo. Tente novamente em instantes.',
  network: 'Não foi possível conectar ao GitHub.',
  unauthorized: 'O GitHub recusou o GITHUB_TOKEN configurado (401).',
  forbidden: 'O GitHub negou acesso ao repositório configurado (403).',
  not_found: 'Repositório de GITHUB_REPO não encontrado no GitHub (404).',
  rate_limited:
    'Limite de requisições do GitHub atingido. Configure GITHUB_TOKEN ou aguarde.',
  http_error: 'O GitHub respondeu com erro inesperado.',
};

/**
 * Feed de novidades a partir dos PRs mergeados no GitHub. Mantém cache em
 * memória por repositório (TTL `CHANGELOG_CACHE_TTL_SECONDS`), compartilha a
 * busca em andamento entre chamadas simultâneas e, se o GitHub falhar, serve
 * o último cache com `stale: true`.
 */
@Injectable()
export class ChangelogService {
  private readonly logger = new Logger(ChangelogService.name);
  private readonly repo: string | null;
  private readonly ttlMs: number;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<CacheEntry>>();

  constructor(
    private readonly client: GithubPullsClient,
    config: ConfigService,
  ) {
    this.repo = config.get<string>('GITHUB_REPO')?.trim() || null;
    this.ttlMs =
      config.getOrThrow<number>('CHANGELOG_CACHE_TTL_SECONDS') * 1000;
  }

  async list(limit: number): Promise<ChangelogFeed> {
    const repo = this.repo;
    if (!repo) return notConfiguredFeed();
    const { entry, stale } = await this.resolve(repo);
    return {
      configured: true,
      repository: repo,
      items: entry.items.slice(0, limit),
      fetchedAt: new Date(entry.fetchedAt).toISOString(),
      stale,
    };
  }

  private async resolve(repo: string): Promise<ResolvedEntry> {
    const cached = this.cache.get(repo);
    if (cached && this.isFresh(cached)) return { entry: cached, stale: false };
    try {
      return { entry: await this.refresh(repo), stale: false };
    } catch (error) {
      return { entry: this.fallback(error, cached), stale: true };
    }
  }

  private isFresh(entry: CacheEntry): boolean {
    return Date.now() - entry.fetchedAt < this.ttlMs;
  }

  private refresh(repo: string): Promise<CacheEntry> {
    const pending = this.inflight.get(repo);
    if (pending) return pending;
    const promise = this.fetch(repo).finally(() => this.inflight.delete(repo));
    this.inflight.set(repo, promise);
    return promise;
  }

  private async fetch(repo: string): Promise<CacheEntry> {
    const pulls = await this.client.listMergedPulls(repo);
    const entry: CacheEntry = { items: toItems(pulls), fetchedAt: Date.now() };
    this.cache.set(repo, entry);
    return entry;
  }

  /** Cache anterior (mesmo vencido) ou 502; erro inesperado é relançado. */
  private fallback(error: unknown, cached: CacheEntry | undefined): CacheEntry {
    if (!(error instanceof GithubClientError)) throw error;
    this.logger.warn(
      `Falha ao buscar PRs no GitHub: reason=${error.reason} status=${error.status ?? 'n/a'}`,
    );
    if (cached) return cached;
    throw new BadGatewayException({
      code: ERROR_CODES.CHANGELOG_SOURCE_UNAVAILABLE,
      message: SOURCE_MESSAGES[error.reason],
    });
  }
}

function notConfiguredFeed(): ChangelogFeed {
  return {
    configured: false,
    repository: null,
    items: [],
    fetchedAt: null,
    stale: false,
  };
}

function toItems(pulls: GithubMergedPull[]): ChangelogItem[] {
  return pulls
    .map(toItem)
    .filter((item): item is ChangelogItem => item !== null)
    .sort((a, b) => Date.parse(b.mergedAt) - Date.parse(a.mergedAt));
}

function toItem(pull: GithubMergedPull): ChangelogItem | null {
  const parsed = parseConventionalTitle(pull.title);
  if (!parsed) return null;
  return {
    type: parsed.type,
    scope: parsed.scope,
    breaking: parsed.breaking,
    title: parsed.description,
    number: pull.number,
    url: pull.url,
    mergedAt: pull.mergedAt,
  };
}
