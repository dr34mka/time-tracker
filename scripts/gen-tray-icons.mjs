/* Генерация template-иконок для меню-бара macOS (electron/assets/).
   Template-картинки — чёрный цвет + альфа, macOS сам перекрашивает под тему.
   Запуск: npm run icons */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '../electron/assets');

/* ---------- минимальный PNG-энкодер (RGBA, без фильтров) ---------- */

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // бит на канал
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- геометрия секундомера в логической сетке 16×16 ---------- */

function inTriangle(px, py, [ax, ay], [bx, by], [cx, cy]) {
  const s1 = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  const s2 = (cx - bx) * (py - by) - (cy - by) * (px - bx);
  const s3 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx);
  return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
}

function inRect(x, y, x1, y1, x2, y2) {
  return x >= x1 && x <= x2 && y >= y1 && y <= y2;
}

function inShape(x, y, glyph) {
  // корпус: кольцо + кнопка сверху
  const d = Math.hypot(x - 8, y - 9);
  if (Math.abs(d - 5) <= 0.7) return true;
  if (inRect(x, y, 7.0, 2.1, 9.0, 3.4)) return true;
  // глиф состояния внутри циферблата
  if (glyph === 'run') return inTriangle(x, y, [6.8, 7.0], [6.8, 11.0], [10.4, 9.0]);
  if (glyph === 'pause')
    return inRect(x, y, 6.6, 7.0, 7.7, 11.0) || inRect(x, y, 8.3, 7.0, 9.4, 11.0);
  // idle: стрелка на 12 часов
  return inRect(x, y, 7.7, 6.0, 8.3, 9.2);
}

function renderIcon(scale, glyph) {
  const px = 16 * scale;
  const rgba = Buffer.alloc(px * px * 4);
  const S = 4; // сабпиксели на ось для сглаживания
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      let hit = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const lx = (x + (sx + 0.5) / S) / scale;
          const ly = (y + (sy + 0.5) / S) / scale;
          if (inShape(lx, ly, glyph)) hit++;
        }
      }
      rgba[(y * px + x) * 4 + 3] = Math.round((255 * hit) / (S * S));
    }
  }
  return encodePng(px, rgba);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const glyph of ['idle', 'run', 'pause']) {
  const base = `tray${glyph[0].toUpperCase()}${glyph.slice(1)}Template`;
  writeFileSync(join(OUT_DIR, `${base}.png`), renderIcon(1, glyph));
  writeFileSync(join(OUT_DIR, `${base}@2x.png`), renderIcon(2, glyph));
  console.log(`${base}.png / @2x`);
}
