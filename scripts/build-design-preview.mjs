import { build } from 'vite';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
await build({ configFile: fileURLToPath(new URL('vite.preview.config.ts', root)) });
const output = new URL('dist-design-preview/', root);
const script = (await readFile(new URL('preview.js', output), 'utf8')).replace(/<\/script/gi, '<\\/script');
const css = (await readFile(new URL('preview.css', output), 'utf8')).replace(/<\/style/gi, '<\\/style');
const scriptHash = createHash('sha256').update(script).digest('base64');
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const licenses = await Promise.all((await readdir(new URL('public/licenses/', root))).map(async name => `${name}\n\n${await readFile(new URL(`public/licenses/${name}`, root), 'utf8')}`));
const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${scriptHash}'; style-src 'unsafe-inline'; font-src data:; img-src data: blob:; connect-src 'none'; base-uri 'none'; form-action 'none'">
<title>Time Tracker — тестовый дизайн</title><style>${css}</style></head>
<body><div id="root"></div><template id="third-party-licenses">${escape(licenses.join('\n\n'))}</template><script>${script}</script></body></html>`;
await writeFile(new URL('time-tracker-design-preview.html', output), html);
console.log(`Standalone preview: ${fileURLToPath(new URL('time-tracker-design-preview.html', output))} (${Buffer.byteLength(html)} bytes)`);
