import { describe, expect, it } from 'vitest';
import { serializeCsv } from './csv';

describe('CSV export', () => {
  it('preserves Cyrillic, quotes, separators and multiline notes', () => {
    expect(serializeCsv([['Проект; «А»', 'a"b', 'line\rnext', 'line\nnext', 12.5]]))
      .toBe('\uFEFF"Проект; «А»";"a""b";"line\rnext";"line\nnext";12.5');
  });
  it('treats spreadsheet formulas as text without changing numeric amounts', () => {
    expect(serializeCsv([['=1+1', '+SUM(A1)', '-1', '@SUM(A1)', '  =1', '\t=1', -12.5]]))
      .toBe("\uFEFF'=1+1;'+SUM(A1);'-1;'@SUM(A1);'  =1;'\t=1;-12.5");
  });
});
