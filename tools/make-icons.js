// Generates simple ruler-style PNG icons with no dependencies.  node tools/make-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x / size, y / size);
      raw.set([r, g, b, a], y * (size * 4 + 1) + 1 + x * 4);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
  ]);
}

// green rounded square with white ruler ticks along the bottom
function pixel(u, v) {
  const r = 0.18, cx = Math.max(Math.abs(u - 0.5) - (0.5 - r), 0), cy = Math.max(Math.abs(v - 0.5) - (0.5 - r), 0);
  if (Math.hypot(cx, cy) > r) return [0, 0, 0, 0];
  const bg = [11, 110, 79, 255], fg = [255, 255, 255, 255];
  // baseline bar
  if (v > 0.62 && v < 0.70 && u > 0.14 && u < 0.86) return fg;
  // ticks: long every 4th, short otherwise
  for (let i = 0; i <= 8; i++) {
    const tx = 0.14 + (0.72 * i) / 8;
    const h = i % 4 === 0 ? 0.34 : 0.2;
    if (Math.abs(u - tx) < 0.028 && v > 0.62 - h && v <= 0.62) return fg;
  }
  return bg;
}

const dir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(dir, { recursive: true });
for (const s of [16, 48, 128]) fs.writeFileSync(path.join(dir, `icon${s}.png`), png(s, pixel));
console.log('icons written to', dir);
