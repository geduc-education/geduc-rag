import { BadGatewayException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ChangelogService } from '../changelog.service';
import {
  GithubClientError,
  GithubMergedPull,
  GithubPullsClient,
} from '../github-pulls.client';

const T0 = new Date('2026-09-28T12:00:00.000Z');
const TTL_SECONDS = 600;

const PULLS: GithubMergedPull[] = [
  {
    number: 42,
    title: 'feat(chat): cita trechos',
    url: 'https://github.com/owner/nome/pull/42',
    mergedAt: '2026-09-20T10:00:00.000Z',
  },
  {
    number: 43,
    title: 'chore: bump',
    url: 'https://github.com/owner/nome/pull/43',
    mergedAt: '2026-09-21T10:00:00.000Z',
  },
  {
    number: 44,
    title: 'fix: corrige login',
    url: 'https://github.com/owner/nome/pull/44',
    mergedAt: '2026-09-22T10:00:00.000Z',
  },
];

function makeConfig(values: Record<string, unknown>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
    getOrThrow: jest.fn((key: string) => {
      if (values[key] === undefined) throw new Error(`missing ${key}`);
      return values[key];
    }),
  } as unknown as ConfigService;
}

function setup(values: Record<string, unknown>) {
  const listMergedPulls = jest.fn<Promise<GithubMergedPull[]>, [string]>();
  const client = { listMergedPulls } as unknown as GithubPullsClient;
  const config = makeConfig({
    CHANGELOG_CACHE_TTL_SECONDS: TTL_SECONDS,
    ...values,
  });
  return { service: new ChangelogService(client, config), listMergedPulls };
}

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('esperava rejeição');
}

describe('ChangelogService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(T0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const NOT_CONFIGURED = {
    configured: false,
    repository: null,
    items: [],
    fetchedAt: null,
    stale: false,
  };

  it('sem GITHUB_REPO devolve o payload não configurado sem chamar o client', async () => {
    const { service, listMergedPulls } = setup({});
    await expect(service.list(50)).resolves.toEqual(NOT_CONFIGURED);
    expect(listMergedPulls).not.toHaveBeenCalled();
  });

  it("GITHUB_REPO '' (ou só espaços) conta como não configurado", async () => {
    for (const repo of ['', '   ']) {
      const { service, listMergedPulls } = setup({ GITHUB_REPO: repo });
      await expect(service.list(50)).resolves.toEqual(NOT_CONFIGURED);
      expect(listMergedPulls).not.toHaveBeenCalled();
    }
  });

  it('filtra títulos fora do padrão e ordena por mergedAt decrescente', async () => {
    const { service, listMergedPulls } = setup({ GITHUB_REPO: 'owner/nome' });
    listMergedPulls.mockResolvedValue(PULLS);

    const feed = await service.list(50);

    expect(listMergedPulls).toHaveBeenCalledWith('owner/nome');
    expect(feed).toEqual({
      configured: true,
      repository: 'owner/nome',
      fetchedAt: T0.toISOString(),
      stale: false,
      items: [
        {
          type: 'fix',
          scope: null,
          breaking: false,
          title: 'corrige login',
          number: 44,
          url: 'https://github.com/owner/nome/pull/44',
          mergedAt: '2026-09-22T10:00:00.000Z',
        },
        {
          type: 'feat',
          scope: 'chat',
          breaking: false,
          title: 'cita trechos',
          number: 42,
          url: 'https://github.com/owner/nome/pull/42',
          mergedAt: '2026-09-20T10:00:00.000Z',
        },
      ],
    });
  });

  it('usa o cache dentro do TTL e busca de novo depois dele', async () => {
    const { service, listMergedPulls } = setup({ GITHUB_REPO: 'owner/nome' });
    listMergedPulls.mockResolvedValue(PULLS);

    await service.list(50);
    await service.list(50);
    expect(listMergedPulls).toHaveBeenCalledTimes(1);

    jest.setSystemTime(T0.getTime() + TTL_SECONDS * 1000);
    const feed = await service.list(50);
    expect(listMergedPulls).toHaveBeenCalledTimes(2);
    expect(feed.fetchedAt).toBe(
      new Date(T0.getTime() + TTL_SECONDS * 1000).toISOString(),
    );
  });

  it('list(1) depois de list(50) devolve 1 item sem nova chamada', async () => {
    const { service, listMergedPulls } = setup({ GITHUB_REPO: 'owner/nome' });
    listMergedPulls.mockResolvedValue(PULLS);

    await service.list(50);
    const feed = await service.list(1);

    expect(feed.items).toHaveLength(1);
    expect(feed.items[0].number).toBe(44);
    expect(listMergedPulls).toHaveBeenCalledTimes(1);
  });

  it('TTL 0 busca a cada list', async () => {
    const { service, listMergedPulls } = setup({
      GITHUB_REPO: 'owner/nome',
      CHANGELOG_CACHE_TTL_SECONDS: 0,
    });
    listMergedPulls.mockResolvedValue(PULLS);

    await service.list(50);
    await service.list(50);
    expect(listMergedPulls).toHaveBeenCalledTimes(2);
  });

  it('chamadas simultâneas com cache vazio compartilham uma busca', async () => {
    const { service, listMergedPulls } = setup({ GITHUB_REPO: 'owner/nome' });
    listMergedPulls.mockResolvedValue(PULLS);

    const feeds = await Promise.all([
      service.list(50),
      service.list(50),
      service.list(50),
    ]);

    expect(listMergedPulls).toHaveBeenCalledTimes(1);
    for (const feed of feeds) expect(feed.items).toHaveLength(2);
  });

  it('sem cache e GithubClientError lança 502 CHANGELOG_SOURCE_UNAVAILABLE', async () => {
    const { service, listMergedPulls } = setup({ GITHUB_REPO: 'owner/nome' });
    listMergedPulls.mockRejectedValue(
      new GithubClientError('rate_limited', 403, 'rate limit'),
    );

    const error = await catchError(service.list(50));

    expect(error).toBeInstanceOf(BadGatewayException);
    const exception = error as BadGatewayException;
    expect(exception.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    expect(exception.getResponse()).toEqual({
      code: 'CHANGELOG_SOURCE_UNAVAILABLE',
      message:
        'Limite de requisições do GitHub atingido. Configure GITHUB_TOKEN ou aguarde.',
    });
  });

  it.each([
    [
      'timeout',
      'O GitHub não respondeu a tempo. Tente novamente em instantes.',
    ],
    ['network', 'Não foi possível conectar ao GitHub.'],
    ['unauthorized', 'O GitHub recusou o GITHUB_TOKEN configurado (401).'],
    ['forbidden', 'O GitHub negou acesso ao repositório configurado (403).'],
    ['not_found', 'Repositório de GITHUB_REPO não encontrado no GitHub (404).'],
    ['http_error', 'O GitHub respondeu com erro inesperado.'],
  ] as const)('reason %s vira a mensagem do 502', async (reason, message) => {
    const { service, listMergedPulls } = setup({ GITHUB_REPO: 'owner/nome' });
    listMergedPulls.mockRejectedValue(new GithubClientError(reason, null, 'x'));

    const error = (await catchError(service.list(50))) as BadGatewayException;

    expect(error.getResponse()).toEqual({
      code: 'CHANGELOG_SOURCE_UNAVAILABLE',
      message,
    });
  });

  it('com cache vencido e GithubClientError devolve os itens anteriores com stale', async () => {
    const { service, listMergedPulls } = setup({ GITHUB_REPO: 'owner/nome' });
    listMergedPulls.mockResolvedValueOnce(PULLS);
    const fresh = await service.list(50);

    jest.setSystemTime(T0.getTime() + (TTL_SECONDS + 1) * 1000);
    listMergedPulls.mockRejectedValueOnce(
      new GithubClientError('rate_limited', 403, 'rate limit'),
    );
    const feed = await service.list(50);

    expect(listMergedPulls).toHaveBeenCalledTimes(2);
    expect(feed).toEqual({ ...fresh, stale: true });
    expect(feed.fetchedAt).toBe(T0.toISOString());
  });

  it('erro que não é GithubClientError é relançado', async () => {
    const { service, listMergedPulls } = setup({ GITHUB_REPO: 'owner/nome' });
    const boom = new TypeError('boom');
    listMergedPulls.mockRejectedValue(boom);

    await expect(service.list(50)).rejects.toBe(boom);
  });
});
