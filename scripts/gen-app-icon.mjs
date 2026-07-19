/* Генерация мастер-иконки приложения (1024×1024 PNG).
   Глиф — контур часов (icons8 "Clock / Material Outlined", 24×24 viewBox:
   ~/Downloads/icons8-clock-material-outlined/icons8-clock-192.svg), белым
   по зелёному фону. В .icns собирается в npm run icons (sips + iconutil,
   только macOS).
   Запуск: node scripts/gen-app-icon.mjs <выходной .png> */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const OUT = process.argv[2] ?? 'build/icon_1024.png';

/* ---------- PNG-энкодер (RGBA), как в gen-tray-icons ---------- */

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
  ihdr[8] = 8;
  ihdr[9] = 6;
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

/* ---------- геометрия ---------- */

const SIZE = 1024;
const WHITE = [255, 255, 255];
// зелёный градиент в стиле акцента приложения (--accent / --accent-2 / light --accent)
const GREEN_TOP = [64, 224, 135];
const GREEN_BOTTOM = [15, 138, 67];

function inRoundedRect(x, y, x1, y1, x2, y2, r) {
  if (x < x1 || x > x2 || y < y1 || y > y2) return false;
  const cx = Math.min(Math.max(x, x1 + r), x2 - r);
  const cy = Math.min(Math.max(y, y1 + r), y2 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r || (x >= x1 + r && x <= x2 - r) || (y >= y1 + r && y <= y2 - r);
}

function glow(x, y, gx, gy, radius, strength) {
  const d = Math.hypot(x - gx, y - gy);
  if (d >= radius) return 0;
  const t = 1 - d / radius;
  return strength * t * t;
}

// стрелки часов из icons8-clock-192.svg (viewBox 0 0 24 24), путь
// "M 11 6 L 11 12.414062 L 15.292969 16.707031 L 16.707031 15.292969 L 13 11.585938 L 13 6 z"
const HAND_POLY = [
  [11, 6],
  [11, 12.414062],
  [15.292969, 16.707031],
  [16.707031, 15.292969],
  [13, 11.585938],
  [13, 6],
];

function inPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const hit = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

// 24-юнитная сетка SVG вписана в 1024px канвас: кольцо (r=10..12) диаметром ~600px
const SCALE = 30;
const CX = 512;
const CY = 512;
function toPx([sx, sy]) {
  return [CX + (sx - 12) * SCALE, CY + (sy - 12) * SCALE];
}
const HAND_PX = HAND_POLY.map(toPx);

function inClockGlyph(x, y) {
  const d = Math.hypot(x - CX, y - CY);
  if (Math.abs(d - 9 * SCALE) <= SCALE) return true; // кольцо: между r=8 и r=10
  return inPolygon(x, y, HAND_PX);
}

/** Цвет сабпикселя [r,g,b,a] (straight alpha) */
function shade(x, y) {
  if (inClockGlyph(x, y)) return [...WHITE, 255];

  // подложка: скруглённый квадрат
  if (!inRoundedRect(x, y, 100, 100, 924, 924, 186)) return [0, 0, 0, 0];
  const t = (x + y - 200) / 1648; // диагональ top-left → bottom-right
  let r = GREEN_TOP[0] + (GREEN_BOTTOM[0] - GREEN_TOP[0]) * t;
  let g = GREEN_TOP[1] + (GREEN_BOTTOM[1] - GREEN_TOP[1]) * t;
  let b = GREEN_TOP[2] + (GREEN_BOTTOM[2] - GREEN_TOP[2]) * t;
  // мягкий блик сверху слева + лёгкая тень позади циферблата для глубины
  const highlight = glow(x, y, 330, 300, 520, 0.16);
  const shadow = glow(x, y, 620, 660, 420, 0.16);
  r += (255 - r) * highlight - r * shadow * 0.5;
  g += (255 - g) * highlight - g * shadow * 0.5;
  b += (255 - b) * highlight - b * shadow * 0.5;
  return [Math.min(255, Math.max(0, r)), Math.min(255, Math.max(0, g)), Math.min(255, Math.max(0, b)), 255];
}

const rgba = Buffer.alloc(SIZE * SIZE * 4);
const S = 3; // сабпиксели на ось
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    // усредняем premultiplied, чтобы не темнить края
    let pr = 0, pg = 0, pb = 0, pa = 0;
    for (let sy = 0; sy < S; sy++) {
      for (let sx = 0; sx < S; sx++) {
        const [r, g, b, a] = shade(x + (sx + 0.5) / S, y + (sy + 0.5) / S);
        pr += (r * a) / 255;
        pg += (g * a) / 255;
        pb += (b * a) / 255;
        pa += a;
      }
    }
    const n = S * S;
    const a = pa / n;
    const i = (y * SIZE + x) * 4;
    if (a > 0) {
      rgba[i] = Math.round((pr / n) * (255 / a));
      rgba[i + 1] = Math.round((pg / n) * (255 / a));
      rgba[i + 2] = Math.round((pb / n) * (255 / a));
      rgba[i + 3] = Math.round(a);
    }
  }
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, encodePng(SIZE, rgba));
console.log(OUT);
