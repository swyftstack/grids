// Generates a simple 1024x1024 brand PNG (orange background) used as the source for `tauri icon`.
// No image dependencies — encodes a truecolor PNG by hand.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const SIZE = 1024;
const BG = [249, 115, 22]; // brand orange
const FG = [255, 255, 255];

// Draw a rounded-ish "S"-evoking mark: a white rounded square block in the center.
function pixel(x, y) {
  const m = SIZE * 0.28;
  const inside = x > m && x < SIZE - m && y > m && y < SIZE - m;
  // Carve two notches to suggest an "S".
  const band = SIZE * 0.14;
  const topNotch = inside && y < SIZE * 0.46 && x > SIZE - m - band;
  const botNotch = inside && y > SIZE * 0.54 && x < m + band;
  return inside && !topNotch && !botNotch ? FG : BG;
}

const raw = Buffer.alloc((SIZE * 3 + 1) * SIZE);
let o = 0;
for (let y = 0; y < SIZE; y++) {
  raw[o++] = 0; // filter: none
  for (let x = 0; x < SIZE; x++) {
    const [r, g, b] = pixel(x, y);
    raw[o++] = r;
    raw[o++] = g;
    raw[o++] = b;
  }
}

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // color type: truecolor
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = process.argv[2] ?? 'apps/desktop/src-tauri/icons/icon-source.png';
writeFileSync(out, png);
console.log(`Wrote ${out} (${png.length} bytes)`);
