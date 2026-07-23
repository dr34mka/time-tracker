/** Печать HTML через скрытый iframe: открывается системный диалог печати,
    где можно выбрать «Сохранить как PDF». Работает и в Electron
    (window.open там перехватывается, iframe — нет). */
export function printHtml(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  win.addEventListener('afterprint', () => {
    setTimeout(() => iframe.remove(), 100);
  });

  // небольшая задержка, чтобы iframe успел отрендериться
  setTimeout(() => {
    win.focus();
    win.print();
  }, 150);
}

/** Сохранить HTML как PDF-файл: рендерится в главном процессе (без диалога
    печати), а скачивается тем же способом, что CSV и бэкап (a[download]) —
    системный диалог «Сохранить как» с понятной обратной связью, вместо
    тихой записи в файловую систему. В браузере (нет window.desktop) —
    фолбэк на системный диалог печати, где тоже можно сохранить как PDF. */
export async function savePdf(html: string, filename: string): Promise<void> {
  const desktop = window.desktop;
  if (desktop?.renderPdf) {
    const base64 = await desktop.renderPdf(html);
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  printHtml(html);
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
