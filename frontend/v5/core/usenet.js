// USENET reading for Resurrection V5. Pure functions: the same code runs in the browser and in Node tests.
//
// Understands what the reconstruction needs from RFC 1036 / RFC 5536 / RFC 2045-2046 articles:
//   - spools: rnews batches ("#! rnews <bytes>"), mbox exports ("From " separators), or a single article
//   - headers with folding, case-insensitive names; Message-ID validation; References / In-Reply-To; Path; Control: cancel
//   - attachments: uuencode (1998 style) and MIME multipart with base64 parts (2004 style)
//   - integrity: CRC-32 and SHA-256 of decoded bytes; size limits; content-type and filename checks
// USENET is a discussion transport, not version control and not a 3D engine. Everything built from these articles is
// a reconstruction, labelled with its provenance.

export const LIMITS = { attachmentBytes: 65536, articleBytes: 262144 };
export const ALLOWED_TYPES = ['text/plain', 'application/x-lastlight'];

// ---- checksums ----------------------------------------------------------------------------------------------
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) { c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } t[n] = c >>> 0; } return t; })();
export function crc32(bytes) { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) { c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8); } return ((c ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0'); }
const K256 = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
export function sha256(bytes) {
  const n = bytes.length, total = Math.ceil((n + 9) / 64) * 64, m = new Uint8Array(total);
  m.set(bytes); m[n] = 0x80; const bits = n * 8;
  for (let i = 0; i < 8; i++) { m[total - 1 - i] = Math.floor(bits / Math.pow(2, 8 * i)) & 255; }
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]), W = new Uint32Array(64);
  const r = (x, k) => (x >>> k) | (x << (32 - k));
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++) { W[i] = (m[o + i * 4] << 24) | (m[o + i * 4 + 1] << 16) | (m[o + i * 4 + 2] << 8) | m[o + i * 4 + 3]; }
    for (let i = 16; i < 64; i++) { const s0 = r(W[i - 15], 7) ^ r(W[i - 15], 18) ^ (W[i - 15] >>> 3), s1 = r(W[i - 2], 17) ^ r(W[i - 2], 19) ^ (W[i - 2] >>> 10); W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0; }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + W[i]) >>> 0, t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return Array.from(H, (x) => x.toString(16).padStart(8, '0')).join('');
}
export const bytes = (s) => { const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) { out[i] = s.charCodeAt(i) & 255; } return out; };
export const text = (b) => { let s = ''; for (let i = 0; i < b.length; i++) { s += String.fromCharCode(b[i]); } return s; };

// ---- spools ---------------------------------------------------------------------------------------------------
export function splitSpool(input) {
  const t = String(input || '').replace(/\r\n/g, '\n');
  if (t.startsWith('#! rnews ')) {
    const out = []; let pos = 0;
    while (pos < t.length) {
      const nl = t.indexOf('\n', pos); if (nl < 0) { break; }
      const m = /^#! rnews (\d+)$/.exec(t.slice(pos, nl)); if (!m) { break; }
      const n = parseInt(m[1], 10); out.push(t.slice(nl + 1, nl + 1 + n)); pos = nl + 1 + n;
    }
    return out;
  }
  if (t.startsWith('From ')) { return t.split(/^From [^\n]*\n/m).filter((a) => a.trim()).map((a) => a.replace(/^>From /gm, 'From ').replace(/\n+$/, '\n')); }
  return t.trim() ? [t] : [];
}

// ---- headers ----------------------------------------------------------------------------------------------------
const MSGID = /^<[^<>@\s]+@[^<>@\s]+>$/;
export const ids = (v) => (String(v || '').match(/<[^<>\s]+>/g) || []).filter((x) => MSGID.test(x));
export function parseHeaders(head) {
  const headers = {}; let last = null;
  for (const line of head.split('\n')) {
    if (/^[ \t]/.test(line) && last) { headers[last] += ' ' + line.trim(); continue; }
    const c = line.indexOf(':'); if (c <= 0) { continue; }
    last = line.slice(0, c).trim().toLowerCase();
    headers[last] = (headers[last] ? headers[last] + ' ' : '') + line.slice(c + 1).trim();
  }
  return headers;
}
// "multipart/mixed; boundary=\"x\"" -> { type: 'multipart/mixed', params: { boundary: 'x' } }
export function contentType(v) {
  const parts = String(v || 'text/plain').split(';'); const params = {};
  parts.slice(1).forEach((p) => { const i = p.indexOf('='); if (i > 0) { params[p.slice(0, i).trim().toLowerCase()] = p.slice(i + 1).trim().replace(/^"|"$/g, ''); } });
  return { type: parts[0].trim().toLowerCase(), params };
}

export function parseArticle(raw, sourceId) {
  const t = String(raw).replace(/\r\n/g, '\n');
  const split = t.indexOf('\n\n');
  const head = split < 0 ? t : t.slice(0, split), body = split < 0 ? '' : t.slice(split + 2);
  const headers = parseHeaders(head);
  const mid = (headers['message-id'] || '').trim();
  const a = {
    source: sourceId, headers, body, raw: t,
    messageId: MSGID.test(mid) ? mid : null,
    from: headers.from || '', date: headers.date || '', subject: headers.subject || '', newsgroups: headers.newsgroups || '',
    path: (headers.path || '').split('!').filter(Boolean), references: ids(headers.references), inReplyTo: ids(headers['in-reply-to']),
    control: headers.control || null, fixture: headers['x-fixture'] || null, bodyExpired: /body-expired/i.test(headers['x-archive'] || ''),
    problem: null
  };
  if (!a.messageId) { a.problem = mid ? 'bad-message-id' : 'no-message-id'; }
  if (t.length > LIMITS.articleBytes) { a.problem = 'too-large'; }
  a.parent = a.references.length ? a.references[a.references.length - 1] : (a.inReplyTo[0] || null);
  a.time = Date.parse(a.date) || 0;
  a.bodyHash = sha256(bytes(body.replace(/\s+$/, '')));
  return a;
}

// ---- attachments ----------------------------------------------------------------------------------------------
export function uudecode(body) {
  const lines = String(body || '').split('\n');
  const start = lines.findIndex((l) => /^begin [0-7]{3,4} \S+/.test(l)); if (start < 0) { return null; }
  const [, mode, name] = /^begin ([0-7]{3,4}) (\S+)/.exec(lines[start]);
  const out = []; let complete = false;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i]; if (l === 'end') { complete = true; break; } if (!l) { continue; }
    const n = (l.charCodeAt(0) - 32) & 63; if (n === 0) { continue; }
    const v = (k) => (l.charCodeAt(k) - 32) & 63; const got = [];
    for (let j = 1; got.length < n && j + 3 <= l.length; j += 4) { const a = v(j), b = v(j + 1), c = v(j + 2), d = v(j + 3); got.push(((a << 2) | (b >> 4)) & 255, ((b << 4) | (c >> 2)) & 255, ((c << 6) | d) & 255); }
    for (let k = 0; k < Math.min(n, got.length); k++) { out.push(got[k]); }
  }
  return { name, mode, bytes: Uint8Array.from(out), complete, encoding: 'uuencode', mediaType: 'application/x-lastlight' };
}
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function base64(s) {
  const clean = String(s).replace(/[^A-Za-z0-9+/=]/g, ''); const out = [];
  if (clean.length % 4 !== 0) { return null; }
  for (let i = 0; i < clean.length; i += 4) {
    const c = [0, 1, 2, 3].map((k) => clean[i + k]); const v = c.map((x) => (x === '=' ? 0 : B64.indexOf(x)));
    if (v.some((x) => x < 0)) { return null; }
    const n = (v[0] << 18) | (v[1] << 12) | (v[2] << 6) | v[3];
    out.push((n >> 16) & 255); if (c[2] !== '=') { out.push((n >> 8) & 255); } if (c[3] !== '=') { out.push(n & 255); }
  }
  return Uint8Array.from(out);
}
// All attachments of an article, whatever the encoding. Each: { name, mediaType, bytes, complete, encoding, problem }.
export function attachments(article) {
  const ct = contentType(article.headers['content-type']);
  const found = [];
  if (ct.type === 'multipart/mixed' && ct.params.boundary) {
    const b = '--' + ct.params.boundary; const segs = article.body.split(b);
    const closed = article.body.includes(b + '--');
    segs.slice(1).forEach((seg) => {
      if (seg.startsWith('--')) { return; }
      const s = seg.replace(/^\n/, ''); const i = s.indexOf('\n\n'); if (i < 0) { return; }
      const h = parseHeaders(s.slice(0, i)), data = s.slice(i + 2);
      const pct = contentType(h['content-type']); const disp = h['content-disposition'] || '';
      const fn = (/filename="?([^";]+)"?/i.exec(disp) || [])[1];
      if (!fn) { return; }                                                              // the text part
      const enc = (h['content-transfer-encoding'] || '7bit').toLowerCase();
      let raw = null; if (enc === 'base64') { raw = base64(data); } else if (enc === '7bit' || enc === '8bit') { raw = bytes(data.replace(/\n$/, '')); }
      const att = { name: fn, mediaType: pct.type, bytes: raw || new Uint8Array(0), complete: closed && !!raw, encoding: enc, problem: null };
      if (!raw) { att.problem = 'bad-encoding'; }
      found.push(att);
    });
  } else { const u = uudecode(article.body); if (u) { found.push(Object.assign(u, { problem: null })); } }
  found.forEach((a) => {
    if (ALLOWED_TYPES.indexOf(a.mediaType) < 0) { a.problem = a.problem || 'type-not-allowed'; }
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(a.name)) { a.problem = a.problem || 'unsafe-name'; }
    if (a.bytes.length > LIMITS.attachmentBytes) { a.problem = a.problem || 'too-large'; }
  });
  return found;
}

// ---- manifests -------------------------------------------------------------------------------------------------
// LLMANIFEST 1 / build <id> / era <year> / parent <msgid> / title ... / credit <who> <role...> /
// asset <id> inline | attach <msgid> <file> <size> <crc32> | wanted <msgid> [trigger=x] / end
export function parseManifest(body) {
  const lines = String(body || '').split('\n');
  const at = lines.findIndex((l) => l.trim() === 'LLMANIFEST 1'); if (at < 0) { return null; }
  const m = { build: null, era: null, parent: null, title: '', credits: [], assets: [], complete: false };
  for (let i = at + 1; i < lines.length; i++) {
    const p = lines[i].trim().split(/\s+/);
    if (p[0] === 'end') { m.complete = true; break; }
    if (p[0] === 'build') { m.build = p[1]; } else if (p[0] === 'era') { m.era = parseInt(p[1], 10); } else if (p[0] === 'parent') { m.parent = p[1]; } else if (p[0] === 'title') { m.title = lines[i].trim().slice(6); } else if (p[0] === 'credit') { m.credits.push({ who: p[1], roles: p.slice(2) }); } else if (p[0] === 'asset') {
      const a = { id: p[1], kind: p[2] };
      if (a.kind === 'attach') { Object.assign(a, { messageId: p[3], file: p[4], size: parseInt(p[5], 10), crc: (p[6] || '').toLowerCase() }); }
      if (a.kind === 'wanted') { a.messageId = p[3]; a.trigger = ((p.find((x) => x.startsWith('trigger=')) || '').split('=')[1]) || null; }
      m.assets.push(a);
    }
  }
  return m.complete && m.build ? m : null;
}

// ---- index over several sources --------------------------------------------------------------------------------
// Cancels apply only within the source that carried them. Copies of one Message-ID are merged; copies whose bodies
// differ are kept side by side and reported as a conflict, never silently overwritten.
export function buildIndex(sources) {
  const messages = new Map(), rejected = [], cancels = [];
  for (const src of sources) {
    const arts = splitSpool(src.text).map((r) => parseArticle(r, src.id));
    const cancelled = new Set();
    arts.forEach((a) => {
      if (a.problem) { rejected.push({ source: src.id, reason: a.problem, subject: a.subject }); return; }
      const c = /^cancel\s+(<[^>]+>)/i.exec(a.control || ''); if (c) { cancelled.add(c[1]); cancels.push({ source: src.id, target: c[1], by: a.from, date: a.date, messageId: a.messageId }); }
    });
    arts.forEach((a) => {
      if (a.problem || a.control) { return; }
      if (!messages.has(a.messageId)) { messages.set(a.messageId, { id: a.messageId, copies: [], cancelledOn: [] }); }
      const m = messages.get(a.messageId);
      if (cancelled.has(a.messageId)) { m.cancelledOn.push(src.id); return; }
      if (!m.copies.some((x) => x.source === src.id)) { m.copies.push(a); }
    });
  }
  const live = new Map(), conflicts = [];
  for (const [id, m] of messages) {
    if (!m.copies.length) { continue; }
    const hashes = [...new Set(m.copies.map((c) => c.bodyHash))];
    m.conflict = hashes.length > 1; if (m.conflict) { conflicts.push({ id, variants: hashes.length, sources: m.copies.map((c) => c.source) }); }
    live.set(id, m);
  }
  const children = new Map(), missing = new Map();
  for (const m of live.values()) {
    const a = m.copies[0]; m.head = a; m.parent = a.parent; m.time = a.time;
    if (a.parent) { if (!children.has(a.parent)) { children.set(a.parent, []); } children.get(a.parent).push(m.id); }
    a.references.forEach((r) => { if (!live.has(r)) { if (!missing.has(r)) { missing.set(r, { id: r, referencedBy: [] }); } missing.get(r).referencedBy.push(m.id); } });
  }
  for (const list of children.values()) { list.sort((x, y) => live.get(x).time - live.get(y).time); }
  return { messages: live, children, missing, rejected, cancels, conflicts, cancelledIds: [...messages.values()].filter((m) => !m.copies.length).map((m) => m.id), sources: sources.map((s) => s.id) };
}
export function thread(index, id) { const m = index.messages.get(id); if (!m) { return []; } return m.head.references.concat([id]).map((r) => ({ id: r, present: index.messages.has(r) })); }

// One copy against what a manifest expects: ok | truncated | corrupt | stripped | rejected
export function checkCopy(article, expect) {
  const att = attachments(article).find((a) => a.name === expect.file) || attachments(article)[0];
  if (!att) { return { source: article.source, status: 'stripped', size: 0, crc: null, sha256: null, bytes: null, name: null, encoding: null }; }
  const crc = crc32(att.bytes), sha = sha256(att.bytes);
  let status = 'ok';
  if (att.problem) { status = 'rejected'; } else if (!att.complete) { status = 'truncated'; } else if (att.bytes.length !== expect.size || crc !== expect.crc || att.name !== expect.file) { status = 'corrupt'; }
  return { source: article.source, status, size: att.bytes.length, crc, sha256: sha, bytes: att.bytes, name: att.name, encoding: att.encoding, problem: att.problem };
}
