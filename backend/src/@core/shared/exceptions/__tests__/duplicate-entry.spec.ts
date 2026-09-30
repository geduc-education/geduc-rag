import { isMysqlDuplicateEntry } from '../400/duplicate-entry';

describe('isMysqlDuplicateEntry', () => {
  it('reconhece errno 1062', () => {
    expect(isMysqlDuplicateEntry({ errno: 1062 })).toBe(true);
  });

  it('reconhece code ER_DUP_ENTRY', () => {
    expect(isMysqlDuplicateEntry({ code: 'ER_DUP_ENTRY' })).toBe(true);
  });

  it('não reconhece pela mensagem', () => {
    expect(isMysqlDuplicateEntry(new Error('Duplicate entry'))).toBe(false);
  });

  it.each([
    undefined,
    null,
    'ER_DUP_ENTRY',
    1062,
    { errno: 1452, code: 'ER_NO_REFERENCED_ROW_2' },
  ])('devolve false para %p', (value) => {
    expect(isMysqlDuplicateEntry(value)).toBe(false);
  });
});
