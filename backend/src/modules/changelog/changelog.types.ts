/** Tipos de PR que entram no changelog (título Conventional Commits). */
export type ChangelogType = 'feat' | 'fix' | 'refactor';

/** Resultado do parser de título Conventional Commits. */
export interface ParsedTitle {
  type: ChangelogType;
  scope: string | null;
  breaking: boolean;
  description: string;
}

/** Item do feed: um PR mergeado com título no padrão. */
export interface ChangelogItem {
  type: ChangelogType;
  scope: string | null;
  breaking: boolean;
  title: string;
  number: number;
  url: string;
  /** ISO 8601. */
  mergedAt: string;
}

/** Payload de `GET /changelog`; `items` ordenado por `mergedAt` decrescente. */
export interface ChangelogFeed {
  configured: boolean;
  repository: string | null;
  items: ChangelogItem[];
  /** ISO 8601 da última busca bem-sucedida, ou `null` sem configuração. */
  fetchedAt: string | null;
  stale: boolean;
}
