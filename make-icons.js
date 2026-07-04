// Generates MacroTrack PWA icons as PNGs with zero dependencies (built-in zlib only).
// Icon = segmented macro donut (orange/green/yellow/purple) on the app's dark bg.
// Run: node make-icons.js
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

/* ---- PNG encoder ---- */
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(size, rgba) {
  const stride = size * 4;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) { const o = y * (stride + 1); raw[o] = 0; for (let x = 0; x < stride; x++) raw[o + 1 + x] = rgba[y * stride + x]; }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/* ---- drawing ---- */
function insideRoundedRect(px, py, x, y, w, h, r) {
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}
const BG = [15, 17, 21];        // #0f1115
const SEG = [[249, 115, 22], [34, 197, 94], [234, 179, 8], [129, 140, 248]]; // cal, protein, carb, fat

function render(size, { maskable = false } = {}) {
  const SS = 3, W = size * SS;                 // supersample for smooth edges
  const buf = new Uint8Array(W * W * 4);
  const cx = W / 2, cy = W / 2;
  const corner = W * 0.22;
  const scale = maskable ? 0.80 : 1.0;         // keep art inside the maskable safe zone
  const Router = W * 0.36 * scale, Rinner = W * 0.205 * scale;
  const gap = 9 * Math.PI / 180;               // gap between segments
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    let col = null;
    if (maskable ? true : insideRoundedRect(x, y, 0, 0, W, W, corner)) col = BG;
    const dx = x - cx, dy = y - cy, dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= Router && dist >= Rinner) {
      let a = (Math.atan2(dy, dx) + Math.PI / 4 + Math.PI * 2) % (Math.PI * 2);
      const seg = Math.floor(a / (Math.PI / 2));
      const within = a - seg * (Math.PI / 2);
      if (within > gap / 2 && within < (Math.PI / 2 - gap / 2)) col = SEG[seg];
    }
    const o = (y * W + x) * 4;
    if (col) { buf[o] = col[0]; buf[o + 1] = col[1]; buf[o + 2] = col[2]; buf[o + 3] = 255; }
  }
  // downsample with premultiplied alpha
  const out = new Uint8Array(size * size * 4), n = SS * SS;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let pr = 0, pg = 0, pb = 0, sa = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const o = ((y * SS + sy) * W + (x * SS + sx)) * 4, al = buf[o + 3] / 255;
      pr += buf[o] * al; pg += buf[o + 1] * al; pb += buf[o + 2] * al; sa += al;
    }
    const oo = (y * size + x) * 4;
    if (sa > 0) { out[oo] = Math.round(pr / sa); out[oo + 1] = Math.round(pg / sa); out[oo + 2] = Math.round(pb / sa); out[oo + 3] = Math.round(sa / n * 255); }
  }
  return encodePNG(size, out);
}

const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, { maskable: true }],
];
for (const [name, size, opts] of targets) {
  fs.writeFileSync(path.join(__dirname, name), render(size, opts));
  console.log('wrote', name, size + 'x' + size);
}
