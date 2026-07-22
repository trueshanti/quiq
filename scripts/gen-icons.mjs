// Generates app icons (a red "eraser disc" glyph: drive platter with a wipe
// stroke across it) as valid PNG files, matching design/icon-concepts/5-eraser-disc.svg.
// Pure Node.js — no native image deps. Run: npm run gen:icons
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src-tauri", "icons");
mkdirSync(outDir, { recursive: true });

// Brand palette (red "eraser disc" design).
const BG = [220, 38, 38]; // red-600, also used for the platter hole + wipe stroke
const FG = [254, 242, 242]; // red-50, the disc platter

// Wipe stroke geometry, in the 128x128 design space (matches the SVG source):
// a rounded rect centered at (56, 95), half-width 36, half-height 7, corner
// radius 7 (i.e. a "stadium" shape), rotated -35 degrees about its own center.
const WIPE_ANGLE_DEG = 35; // inverse rotation angle used to test membership
const WIPE_COS = Math.cos((WIPE_ANGLE_DEG * Math.PI) / 180);
const WIPE_SIN = Math.sin((WIPE_ANGLE_DEG * Math.PI) / 180);

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePng(size) {
  const scale = size / 128;
  const cx = size / 2;
  const cy = size / 2;
  const rPlatter = 40 * scale;
  const rHole = 14 * scale;
  // Wipe stroke geometry scaled from the 128x128 design space.
  const pivotX = 56 * scale;
  const pivotY = 95 * scale;
  const halfWidth = 36 * scale;
  const halfHeight = 7 * scale;
  const straightHalfWidth = halfWidth - halfHeight; // corner radius == halfHeight

  // Supersample each pixel on a SSxSS sub-grid and average, so edges (disc,
  // hole, rotated wipe stroke) are anti-aliased instead of jagged/aliased.
  const SS = 4;
  const SS2 = SS * SS;

  function sampleColor(x, y) {
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.sqrt(dx * dx + dy * dy);

    let c = BG;
    if (d <= rPlatter) c = FG;
    if (d <= rHole) c = BG;

    const relX = x - pivotX;
    const relY = y - pivotY;
    const qx = relX * WIPE_COS - relY * WIPE_SIN;
    const qy = relX * WIPE_SIN + relY * WIPE_COS;
    const inStraight = Math.abs(qy) <= halfHeight && Math.abs(qx) <= straightHalfWidth;
    const capDist = Math.sqrt((Math.abs(qx) - straightHalfWidth) ** 2 + qy * qy);
    const inCap = Math.abs(qx) > straightHalfWidth && capDist <= halfHeight;
    if (inStraight || inCap) c = BG;

    return c;
  }

  // Raw image: each row prefixed with filter byte 0.
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const o = y * stride + 1 + x * 4;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          const c = sampleColor(px, py);
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      raw[o] = Math.round(r / SS2);
      raw[o + 1] = Math.round(g / SS2);
      raw[o + 2] = Math.round(b / SS2);
      raw[o + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const targets = [
  ["32x32.png", 32],
  ["128x128.png", 128],
  ["128x128@2x.png", 256],
  ["icon.png", 512],
];

for (const [name, size] of targets) {
  writeFileSync(join(outDir, name), makePng(size));
  console.log("wrote", name, `(${size}x${size})`);
}
console.log("Done. For polished icons later run: npm run tauri icon <a-1024px.png>");
