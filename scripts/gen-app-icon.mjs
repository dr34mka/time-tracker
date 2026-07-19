/* Генерация мастер-иконки приложения (1024×1024 PNG).
   Дизайн повторяет трей и приложение: тёмный скруглённый квадрат с мягким
   свечением, белый секундомер, зелёный play. В .icns собирается в npm run icons
   (sips + iconutil, только macOS).
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

/* ---------- сцена ---------- */

const SIZE = 1024;
const INK = [245, 245, 247];
const ACCENT = [48, 209, 88];
const GLOW_YELLOW = [255, 214, 10];

function inRoundedRect(x, y, x1, y1, x2, y2, r) {
  if (x < x1 || x > x2 || y < y1 || y > y2) return false;
  const cx = Math.min(Math.max(x, x1 + r), x2 - r);
  const cy = Math.min(Math.max(y, y1 + r), y2 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r || (x >= x1 + r && x <= x2 - r) || (y >= y1 + r && y <= y2 - r);
}

function inTriangle(px, py, [ax, ay], [bx, by], [cx, cy]) {
  const s1 = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  const s2 = (cx - bx) * (py - by) - (cy - by) * (px - bx);
  const s3 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx);
  return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
}

function glow(x, y, gx, gy, radius, strength) {
  const d = Math.hypot(x - gx, y - gy);
  if (d >= radius) return 0;
  const t = 1 - d / radius;
  return strength * t * t;
}

/** Цвет сабпикселя [r,g,b,a] (straight alpha) */
function shade(x, y) {
  // корпус секундомера
  const ring = Math.abs(Math.hypot(x - 512, y - 585) - 255) <= 27;
  const crown = inRoundedRect(x, y, 472, 240, 552, 306, 18);
  if (ring || crown) return [...INK, 255];
  // play-триугольник
  if (inTriangle(x, y, [445, 480], [445, 690], [640, 585])) return [...ACCENT, 255];

  // подложка: скруглённый квадрат
  if (!inRoundedRect(x, y, 100, 100, 924, 924, 186)) return [0, 0, 0, 0];
  const t = (y - 100) / 824;
  let r = 33 + (11 - 33) * t;
  let g = 33 + (11 - 33) * t;
  let b = 38 + (13 - 38) * t;
  // свечения: зелёное сверху слева, жёлтое справа (как фон приложения),
  // плюс зелёный ореол за триугольником
  const gGreen = glow(x, y, 400, 260, 480, 0.16);
  const gYellow = glow(x, y, 830, 180, 380, 0.07);
  const gHalo = glow(x, y, 525, 585, 215, 0.3);
  r += ACCENT[0] * (gGreen + gHalo) + GLOW_YELLOW[0] * gYellow;
  g += ACCENT[1] * (gGreen + gHalo) + GLOW_YELLOW[1] * gYellow;
  b += ACCENT[2] * (gGreen + gHalo) + GLOW_YELLOW[2] * gYellow;
  return [Math.min(255, r), Math.min(255, g), Math.min(255, b), 255];
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
