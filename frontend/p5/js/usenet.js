// USENET reading for P5. Pure functions, no DOM, no Three.js: the same code runs in the browser and in Node tests.
//
// What it understands (the parts of RFC 1036 / RFC 5536 the game needs):
//   - spools: an rnews batch ("#! rnews <bytes>" before each article), an mbox export ("From " separator lines),
//     or a single article;
//   - headers with continuation lines (folding), case-insensitive names;
//   - Message-ID (validated), References and In-Reply-To (reply graph), Path (where a copy travelled), Control: cancel;
//   - uuencoded attachments ("begin <mode> <name>" ... "end"), checked with CRC-32 against a manifest.
// It does not pretend USENET is anything more than text articles copied between servers. Everything the game builds
// from them (the bridge, the town builds) is a reconstruction, labelled as such in the interface.

// ---- CRC-32 (IEEE 802.3, the one zip and PNG use) --------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) { c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } t[n] = c >>> 0; }
  return t;
})();
export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) { c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8); }
  return ((c ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}
export const bytesToText = (b) => { let s = ''; for (let i = 0; i < b.length; i++) { s += String.fromCharCode(b[i]); } return s; };

// ---- splitting a spool into articles -----------------------------------------------------------------------
export function splitSpool(text) {
  const t = String(text || '').replace(/\r\n/g, '\n');
  if (t.startsWith('#! rnews ')) {
    const out = []; let pos = 0;
    while (pos < t.length) {
      const nl = t.indexOf('\n', pos); if (nl < 0) { break; }
      const m = /^#! rnews (\d+)$/.exec(t.slice(pos, nl));
      if (!m) { break; }                                     // a broken batch: stop, keep what was read
      const n = parseInt(m[1], 10);
      out.push(t.slice(nl + 1, nl + 1 + n)); pos = nl + 1 + n;
    }
    return out;
  }
  if (t.startsWith('From ')) {
    return t.split(/^From [^\n]*\n/m).filter((a) => a.trim()).map((a) => a.replace(/^>From /gm, 'From ').replace(/\n+$/, '\n'));
  }
  return t.trim() ? [t] : [];
}

// ---- one article -------------------------------------------------------------------------------------------
const MSGID = /^<[^<>@\s]+@[^<>@\s]+>$/;
export const ids = (v) => (String(v || '').match(/<[^<>\s]+>/g) || []).filter((x) => MSGID.test(x));

export function parseArticle(raw, sourceId) {
  const text = String(raw).replace(/\r\n/g, '\n');
  const split = text.indexOf('\n\n');
  const head = split < 0 ? text : text.slice(0, split), body = split < 0 ? '' : text.slice(split + 2);
  const headers = {}; let last = null;
  for (const line of head.split('\n')) {
    if (/^[ \t]/.test(line) && last) { headers[last] += ' ' + line.trim(); continue; }   // folded continuation
    const c = line.indexOf(':'); if (c <= 0) { continue; }
    last = line.slice(0, c).trim().toLowerCase();
    headers[last] = (headers[last] ? headers[last] + ' ' : '') + line.slice(c + 1).trim();
  }
  const messageId = (headers['message-id'] || '').trim();
  const art = {
    source: sourceId, headers, body,
    messageId: MSGID.test(messageId) ? messageId : null,
    from: headers.from || '', date: headers.date || '', subject: headers.subject || '', newsgroups: headers.newsgroups || '',
    path: (headers.path || '').split('!').filter(Boolean),
    references: ids(headers.references), inReplyTo: ids(headers['in-reply-to']),
    control: headers.control || null,
    bodyExpired: /body-expired/i.test(headers['x-archive'] || ''),
    problem: null
  };
  if (!art.messageId) { art.problem = messageId ? 'bad-message-id' : 'no-message-id'; }
  art.parent = art.references.length ? art.references[art.references.length - 1] : (art.inReplyTo[0] || null);
  art.time = Date.parse(art.date) || 0;
  return art;
}

// ---- uuencoded attachments ---------------------------------------------------------------------------------
// Returns null when the body has no "begin" line. complete is false when "end" never arrives (a cut-off copy).
export function uudecode(body) {
  const lines = String(body || '').split('\n');
  const start = lines.findIndex((l) => /^begin [0-7]{3,4} \S+/.test(l));
  if (start < 0) { return null; }
  const [, mode, name] = /^begin ([0-7]{3,4}) (\S+)/.exec(lines[start]);
  const out = []; let complete = false;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l === 'end') { complete = true; break; }
    if (!l) { continue; }
    const n = (l.charCodeAt(0) - 32) & 63; if (n === 0) { continue; }
    const v = (k) => (l.charCodeAt(k) - 32) & 63;
    const got = [];
    for (let j = 1; got.length < n && j + 3 <= l.length; j += 4) {
      const a = v(j), b = v(j + 1), c = v(j + 2), d = v(j + 3);
      got.push(((a << 2) | (b >> 4)) & 255, ((b << 4) | (c >> 2)) & 255, ((c << 6) | d) & 255);
    }
    for (let k = 0; k < Math.min(n, got.length); k++) { out.push(got[k]); }
  }
  return { name, mode, bytes: Uint8Array.from(out), complete };
}

// ---- manifests (the Last Light build lists, posted as plain text) ------------------------------------------
export function parseManifest(body) {
  const lines = String(body || '').split('\n');
  const at = lines.findIndex((l) => l.trim() === 'LLMANIFEST 1');
  if (at < 0) { return null; }
  const m = { build: null, title: '', credits: [], assets: [], complete: false };
  for (let i = at + 1; i < lines.length; i++) {
    const p = lines[i].trim().split(/\s+/);
    if (p[0] === 'end') { m.complete = true; break; }
    if (p[0] === 'build') { m.build = p[1]; } else if (p[0] === 'title') { m.title = lines[i].trim().slice(6); } else if (p[0] === 'credit') { m.credits.push({ who: p[1], what: p.slice(2) }); } else if (p[0] === 'asset') {
      const a = { id: p[1], kind: p[2] };
      if (a.kind === 'attach') { Object.assign(a, { messageId: p[3], file: p[4], size: parseInt(p[5], 10), crc: (p[6] || '').toLowerCase() }); }
      if (a.kind === 'wanted') { a.messageId = p[3]; a.trigger = ((p.find((x) => x.startsWith('trigger=')) || '').split('=')[1]) || null; }
      m.assets.push(a);
    }
  }
  return m.complete && m.build ? m : null;
}

// ---- an index over several sources -----------------------------------------------------------------------
// sources: [{ id, text }]. Cancels apply only inside the source that carried them (a server that processed a cancel
// lost its copy; a disk saved earlier did not). Copies of the same Message-ID from different sources are merged.
export function buildIndex(sources) {
  const messages = new Map(), rejected = [], cancels = [];
  for (const src of sources) {
    const arts = splitSpool(src.text).map((r) => parseArticle(r, src.id));
    const cancelled = new Set();
    for (const a of arts) {
      if (a.problem) { rejected.push({ source: src.id, reason: a.problem, subject: a.subject }); continue; }
      const c = /^cancel\s+(<[^>]+>)/i.exec(a.control || '');
      if (c) { cancelled.add(c[1]); cancels.push({ source: src.id, target: c[1], by: a.from, date: a.date, messageId: a.messageId }); }
    }
    for (const a of arts) {
      if (a.problem || a.control) { continue; }
      if (!messages.has(a.messageId)) { messages.set(a.messageId, { id: a.messageId, copies: [], cancelledOn: [] }); }
      const m = messages.get(a.messageId);
      if (cancelled.has(a.messageId)) { m.cancelledOn.push(src.id); continue; }
      if (!m.copies.some((x) => x.source === src.id)) { m.copies.push(a); }   // the same source twice is one copy
    }
  }
  // drop messages that survive nowhere, but remember them as cancelled
  const live = new Map();
  for (const [id, m] of messages) { if (m.copies.length) { live.set(id, m); } }
  // reply graph; parents that no source holds become "missing" nodes, known only from References
  const children = new Map(), missing = new Map();
  for (const m of live.values()) {
    const a = m.copies[0];
    m.head = a; m.parent = a.parent; m.time = a.time;
    if (a.parent) {
      if (!children.has(a.parent)) { children.set(a.parent, []); }
      children.get(a.parent).push(m.id);
      if (!live.has(a.parent)) { if (!missing.has(a.parent)) { missing.set(a.parent, { id: a.parent, referencedBy: [] }); } missing.get(a.parent).referencedBy.push(m.id); }
    }
    a.references.forEach((r) => { if (!live.has(r) && !missing.has(r)) { missing.set(r, { id: r, referencedBy: [m.id] }); } });
  }
  for (const list of children.values()) { list.sort((x, y) => live.get(x).time - live.get(y).time); }
  return { messages: live, children, missing, rejected, cancels, cancelledIds: [...messages.values()].filter((m) => !m.copies.length).map((m) => m.id), sources: sources.map((s) => s.id) };
}

// Root-first chain of ancestors of a message, using References (oldest first), present or missing.
export function thread(index, id) {
  const m = index.messages.get(id); if (!m) { return []; }
  return m.head.references.concat([id]).map((r) => ({ id: r, present: index.messages.has(r) }));
}

// What one copy of an attachment looks like against what a manifest expects.
//   ok         complete, size and CRC-32 match
//   truncated  decoded part way, then stops (no "end"); CRC fails
//   corrupt    complete but size or CRC wrong
//   stripped   the copy has no attachment at all
export function checkCopy(article, expect) {
  const dec = uudecode(article.body);
  if (!dec) { return { source: article.source, status: 'stripped', size: 0, crc: null, bytes: null, name: null }; }
  const crc = crc32(dec.bytes);
  const good = dec.complete && dec.bytes.length === expect.size && crc === expect.crc && dec.name === expect.file;
  return { source: article.source, status: good ? 'ok' : (dec.complete ? 'corrupt' : 'truncated'), size: dec.bytes.length, crc, bytes: dec.bytes, name: dec.name };
}
