// Developer tool: a tiny software implementation of the canvas subset the game draws with, so scenes can be
// rendered to PNG in Node and reviewed without a browser. Supported: fillStyle, globalAlpha, fillRect,
// clearRect, drawImage (3, 5 and 9 argument forms, unscaled). The game uses nothing else.
'use strict';
const zlib = require('node:zlib');

const colorCache = new Map();
function parseColor(s) {
  const hit = colorCache.get(s); if (hit) return hit;
  const v = parseColor0(s); colorCache.set(s, v); return v;
}
function parseColor0(s) {
  if (s[0] === '#') {
    let h = s.slice(1);
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(',').map((x) => parseFloat(x));
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  throw new Error('softcanvas: unsupported colour ' + s);
}

function makeCanvas(w, h) {
  const canvas = { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
  const ctx = {
    canvas,
    fillStyle: '#000',
    globalAlpha: 1,
    imageSmoothingEnabled: false,
    fillRect(x, y, rw, rh) {
      const [r, g, b, a0] = parseColor(this.fillStyle);
      const a = a0 * this.globalAlpha;
      const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y));
      const x1 = Math.min(w, Math.round(x + rw)), y1 = Math.min(h, Math.round(y + rh));
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * w + xx) * 4;
          const da = canvas.data[i + 3] / 255;
          const oa = a + da * (1 - a);
          if (oa <= 0) continue;
          canvas.data[i] = (r * a + canvas.data[i] * da * (1 - a)) / oa;
          canvas.data[i + 1] = (g * a + canvas.data[i + 1] * da * (1 - a)) / oa;
          canvas.data[i + 2] = (b * a + canvas.data[i + 2] * da * (1 - a)) / oa;
          canvas.data[i + 3] = oa * 255;
        }
      }
    },
    clearRect(x, y, rw, rh) {
      for (let yy = Math.max(0, y); yy < Math.min(h, y + rh); yy++) {
        for (let xx = Math.max(0, x); xx < Math.min(w, x + rw); xx++) canvas.data.fill(0, (yy * w + xx) * 4, (yy * w + xx) * 4 + 4);
      }
    },
    drawImage(src, ...a) {
      let sx = 0, sy = 0, sw = src.width, sh = src.height, dx, dy;
      if (a.length === 2) { [dx, dy] = a; } else if (a.length === 4) { [dx, dy] = a; } else { [sx, sy, sw, sh, dx, dy] = a; }
      dx = Math.round(dx); dy = Math.round(dy);
      const ga = this.globalAlpha;
      for (let yy = 0; yy < sh; yy++) {
        const ty = dy + yy;
        if (ty < 0 || ty >= h) continue;
        for (let xx = 0; xx < sw; xx++) {
          const tx = dx + xx;
          if (tx < 0 || tx >= w) continue;
          const si = ((sy + yy) * src.width + (sx + xx)) * 4;
          const sa = (src.data[si + 3] / 255) * ga;
          if (sa <= 0) continue;
          const di = (ty * w + tx) * 4;
          const da = canvas.data[di + 3] / 255;
          const oa = sa + da * (1 - sa);
          for (let k = 0; k < 3; k++) canvas.data[di + k] = (src.data[si + k] * sa + canvas.data[di + k] * da * (1 - sa)) / oa;
          canvas.data[di + 3] = oa * 255;
        }
      }
    }
  };
  canvas.getContext = () => ctx;
  return canvas;
}

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

// Encodes a canvas as PNG, upscaled by an integer factor with nearest-neighbour sampling.
function toPNG(canvas, scale = 3) {
  const w = canvas.width * scale, h = canvas.height * scale;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const si = (Math.floor(y / scale) * canvas.width + Math.floor(x / scale)) * 4;
      const a = canvas.data[si + 3] / 255;
      const o = y * (w * 4 + 1) + 1 + x * 4;
      // Flatten onto a mid-grey checker so transparent areas are visible in contact sheets.
      const bg = ((x >> 3) + (y >> 3)) & 1 ? 70 : 90;
      for (let k = 0; k < 3; k++) raw[o + k] = canvas.data[si + k] * a + bg * (1 - a);
      raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

module.exports = { makeCanvas, toPNG };
