import { ChangelogType, ParsedTitle } from './changelog.types';

const CONVENTIONAL_TITLE =
  /^(feat|fix|refactor)(?:\(([^()]*\S[^()]*)\))?(!)?:\s+(\S.*)$/i;

/**
 * Interpreta um título de PR no padrão Conventional Commits.
 * Aceita só `feat`, `fix` e `refactor` (sem diferenciar maiúsculas); qualquer
 * outro tipo, escopo vazio, falta de espaço após `:` ou descrição vazia → `null`.
 */
export function parseConventionalTitle(title: string): ParsedTitle | null {
  const match = CONVENTIONAL_TITLE.exec(title.trim());
  if (!match) return null;
  const [, type, scope, bang, description] = match;
  return {
    type: type.toLowerCase() as ChangelogType,
    scope: scope ? scope.trim() : null,
    breaking: bang === '!',
    description: description.trim(),
  };
}
