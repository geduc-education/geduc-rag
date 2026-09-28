import { parseConventionalTitle } from '../changelog-title.parser';

describe('parseConventionalTitle', () => {
  it('extrai tipo, escopo e descrição', () => {
    expect(parseConventionalTitle('feat(chat): cita trechos')).toEqual({
      type: 'feat',
      scope: 'chat',
      breaking: false,
      description: 'cita trechos',
    });
  });

  it('marca breaking sem escopo', () => {
    expect(parseConventionalTitle('fix!: corrige login')).toEqual({
      type: 'fix',
      scope: null,
      breaking: true,
      description: 'corrige login',
    });
  });

  it('aceita escopo e breaking juntos', () => {
    expect(parseConventionalTitle('refactor(api)!: extrai client')).toEqual({
      type: 'refactor',
      scope: 'api',
      breaking: true,
      description: 'extrai client',
    });
  });

  it('normaliza o tipo em minúsculas', () => {
    expect(parseConventionalTitle('Feat: novo menu')?.type).toBe('feat');
    expect(parseConventionalTitle('FIX: x')?.type).toBe('fix');
  });

  it('aplica trim no título, no escopo e na descrição', () => {
    expect(parseConventionalTitle('  feat(Chat):  Novo menu  ')).toEqual({
      type: 'feat',
      scope: 'Chat',
      breaking: false,
      description: 'Novo menu',
    });
  });

  it.each([
    'chore: bump',
    'docs(readme): ajuste',
    "Merge branch 'main'",
    'feat:sem espaço',
    'feat(): vazio',
    'feat: ',
  ])('devolve null para %p', (title) => {
    expect(parseConventionalTitle(title)).toBeNull();
  });
});
