/** Экспорт строк в CSV-файл (UTF-8 с BOM, чтобы Excel открывал кириллицу) */
export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const escape = (v: string | number): string => {
    const s = String(v);
    if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = rows.map((r) => r.map(escape).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
