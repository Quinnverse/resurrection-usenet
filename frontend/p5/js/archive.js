// The game's view of the archive: which sources are searched, which builds they contain, and whether an asset can be
// restored. Pure functions on top of usenet.js. The world and the story only ever ask this module; nothing is hard-coded
// as "restorable": if the data does not support it, the game cannot do it.
import { buildIndex, parseManifest, checkCopy, bytesToText } from './usenet.js';

// The two public archives are always searched. Mom's backup disk is searched only when the player adds it.
export const SOURCES = [
  { id: 'mirror', file: 'mirror.oldnet.example.spool', host: 'mirror.oldnet.example', optional: false },
  { id: 'groups', file: 'groups.archive.example.mbox', host: 'groups.archive.example', optional: false },
  { id: 'disk', file: 'skylark-backup.spool', host: 'skylark-backup (3.5" disk)', optional: true }
];
export const BUILDS = ['1998', '2004'];

// texts: { mirror: '...', groups: '...', disk: '...' }. included: { disk: true|false }.
export function createArchive(texts) {
  const cache = new Map();
  return {
    texts,
    view(included) {
      const ids = SOURCES.filter((s) => !s.optional || (included && included[s.id])).map((s) => s.id).filter((id) => typeof texts[id] === 'string');
      const key = ids.join(',');
      if (!cache.has(key)) { cache.set(key, buildIndex(ids.map((id) => ({ id, text: texts[id] })))); }
      return cache.get(key);
    }
  };
}

// Build manifests found in a view: { '1998': { manifest, messageId, sources, article }, '2004': ... }
export function manifests(index) {
  const out = {};
  for (const m of index.messages.values()) {
    for (const copy of m.copies) {
      const man = parseManifest(copy.body);
      if (!man) { continue; }
      if (!out[man.build]) { out[man.build] = { manifest: man, messageId: m.id, sources: [], article: copy }; }
      if (out[man.build].sources.indexOf(copy.source) < 0) { out[man.build].sources.push(copy.source); }
    }
  }
  return out;
}
export const buildAvailable = (index, build) => !!manifests(index)[build];

// Asset ids that make up a build (the world shows exactly these).
export function buildAssets(index, build) {
  const b = manifests(index)[build];
  return b ? new Set(b.manifest.assets.map((a) => a.id)) : new Set();
}

// Can this asset be restored in this build, from the sources in this view?
// Returns { status: 'ok' | 'damaged' | 'unlisted' | 'nobuild', copies: [...], use, data, entry, build }.
export function resolveAsset(index, build, assetId) {
  const b = manifests(index)[build];
  if (!b) { return { status: 'nobuild', copies: [], build }; }
  const entry = b.manifest.assets.find((a) => a.id === assetId);
  if (!entry || entry.kind !== 'attach') { return { status: 'unlisted', copies: [], build, entry: entry || null }; }
  const msg = index.messages.get(entry.messageId);
  const copies = msg ? msg.copies.map((c) => Object.assign(checkCopy(c, entry), { article: c })) : [];
  const use = copies.find((c) => c.status === 'ok') || null;
  return { status: use ? 'ok' : 'damaged', copies, use, entry, build, manifestId: b.messageId, data: use ? bytesToText(use.bytes) : null,
    partial: use ? null : bestPartial(copies) };
}
function bestPartial(copies) {
  const p = copies.filter((c) => c.bytes && c.bytes.length).sort((a, b) => b.bytes.length - a.bytes.length)[0];
  return p ? bytesToText(p.bytes) : null;
}

// A "wanted" record: something a build waits for by Message-ID (the summer build's lighthouse rule).
// status: 'none' (no source has it), 'envelope' (headers only, the text expired), 'present'.
export function resolveWanted(index, build, assetId) {
  const b = manifests(index)[build]; if (!b) { return { status: 'nobuild' }; }
  const entry = b.manifest.assets.find((a) => a.id === assetId && a.kind === 'wanted');
  if (!entry) { return { status: 'unlisted' }; }
  const msg = index.messages.get(entry.messageId);
  if (!msg) { return { status: 'none', entry, referencedBy: (index.missing.get(entry.messageId) || {}).referencedBy || [] }; }
  const a = msg.copies[0];
  return { status: a.bodyExpired ? 'envelope' : 'present', entry, article: a, sources: msg.copies.map((c) => c.source) };
}

// June's bridge file (bridge.ll). Tolerates a cut-off file: it reads every complete line it can.
export function parseBridge(text) {
  const out = { by: null, note: '', span: 0, width: 2.2, rail: 0.95, planks: [], posts: [], complete: false };
  if (!text) { return out; }
  const lines = String(text).split('\n');
  const whole = /\n$/.test(text) ? lines.slice(0, -1) : lines.slice(0, -1);   // the last line of a cut file is partial
  for (const l of whole) {
    const p = l.trim().split(/\s+/);
    if (p[0] === 'by') { out.by = p[1]; } else if (p[0] === 'note') { out.note = l.trim().slice(5); } else if (p[0] === 'span') { out.span = +p[1]; } else if (p[0] === 'width') { out.width = +p[1]; } else if (p[0] === 'rail') { out.rail = +p[1]; } else if (p[0] === 'plank' && p.length >= 6) { out.planks.push({ z: +p[1], d: +p[2], tilt: +p[3], side: +p[4], len: +p[5] }); } else if (p[0] === 'post') { out.posts.push(+p[1]); } else if (p[0] === 'end') { out.complete = true; }
  }
  return out;
}

// Everything the story needs to know about the archive at this moment, in one small object.
export function facts(archive, included, build) {
  const idx = archive.view(included);
  const bridge = resolveAsset(idx, build, 'bridge');
  return {
    bridgeOk: bridge.status === 'ok',
    has1998: buildAvailable(idx, '1998'),
    has2004: buildAvailable(idx, '2004'),
    messages: idx.messages.size,
    sources: idx.sources.length
  };
}
