/** Escape CSV text and prevent spreadsheet apps from executing user-supplied formulas. */
export function serializeCsv(rows: (string | number)[][]): string {
  const escape = (value: string | number): string => {
    let text = String(value);
    if (typeof value === 'string' && /^\s*[=+@-]|^[\t\r\n]/.test(text)) text = "'" + text;
    return /[",;\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return '\uFEFF' + rows.map(row => row.map(escape).join(';')).join('\r\n');
}

/** UTF-8 BOM preserves Cyrillic in Excel. */
export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const blob = new Blob([serializeCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
