// Archive -> Parser -> Provenance -> Build Manifest -> Scene Graph. Pure functions on top of usenet.js.
// Nothing in the game is restorable by decree: an object exists in a build only if a manifest lists it, and an
// attached asset can be restored only if an intact copy exists in some source. Changing the fixture changes the world.
import { buildIndex, parseManifest, checkCopy, text, sha256, bytes } from './usenet.js';

// Sources Mara's computer can reach. `public` sources are what the game loads by default; Elena's backup disk is
// searched when Mara restores something.
export const SOURCES = [
  { id: 'mirror', file: 'mirror.oldnet.example.spool', host: 'mirror.oldnet.example', public: true },
  { id: 'groups', file: 'groups.archive.example.mbox', host: 'groups.archive.example', public: true },
  { id: 'disk', file: 'skylark-backup.spool', host: 'skylark backup disk', public: false }
];
export const EXTRA_FILES = { edition: 'edition-present.txt', drafts: 'drafts-unsent.txt' };
export const ERA_BUILD = { 1998: 'summer-0.9', 2004: 'public-1.0' };
export const STATUS = { RESTORED: 'RESTORED', RECONSTRUCTED: 'RECONSTRUCTED', CREATED: 'CREATED' };

// texts: { mirror, groups, disk, edition?, drafts? }. A different `disk` text (e.g. the missing-plank variant) gives a
// different world: that is the provenance test.
export function createArchive(texts) {
  const cache = new Map();
  const view = (ids) => {
    const list = (ids || SOURCES.map((s) => s.id)).filter((id) => typeof texts[id] === 'string');
    const key = list.join(','); if (!cache.has(key)) { cache.set(key, buildIndex(list.map((id) => ({ id, text: texts[id] })))); }
    return cache.get(key);
  };
  const ar = {
    texts, view,
    all: () => view(null),
    publicView: () => view(SOURCES.filter((s) => s.public).map((s) => s.id)),
    edition: texts.edition ? parseManifest(texts.edition) : null,
    drafts: texts.drafts || ''
  };
  return ar;
}

// Build manifests in an index: { 'summer-0.9': { manifest, messageId, sources, article } }
export function manifests(index) {
  const out = {};
  for (const m of index.messages.values()) {
    for (const copy of m.copies) {
      const man = parseManifest(copy.body); if (!man) { continue; }
      if (!out[man.build]) { out[man.build] = { manifest: man, messageId: m.id, sources: [], article: copy }; }
      if (out[man.build].sources.indexOf(copy.source) < 0) { out[man.build].sources.push(copy.source); }
    }
  }
  return out;
}
export const buildFor = (index, era) => manifests(index)[ERA_BUILD[era]] || null;

// Resolve one attached asset of a build. status: ok | damaged | unlisted | nobuild
export function resolveAsset(index, era, assetId) {
  const b = buildFor(index, era);
  if (!b) { return { status: 'nobuild', copies: [], era }; }
  const entry = b.manifest.assets.find((a) => a.id === assetId);
  if (!entry || entry.kind !== 'attach') { return { status: 'unlisted', copies: [], era, entry: entry || null }; }
  const msg = index.messages.get(entry.messageId);
  const copies = msg ? msg.copies.map((c) => Object.assign(checkCopy(c, entry), { article: c })) : [];
  const use = copies.find((c) => c.status === 'ok') || null;
  const partial = use ? null : (copies.filter((c) => c.bytes && c.bytes.length).sort((x, y) => y.bytes.length - x.bytes.length)[0] || null);
  return { status: use ? 'ok' : 'damaged', copies, use, entry, era, manifestId: b.messageId, conflict: !!(msg && msg.conflict),
    data: use ? text(use.bytes) : null, partial: partial ? text(partial.bytes) : null };
}

// A provenance record for something placed in the world.
export function provenance(res, status, transforms) {
  if (!res || res.status !== 'ok') { return null; }
  return { recordId: res.entry.messageId, manifestId: res.manifestId, era: res.era, status: status || STATUS.RESTORED, source: res.use.source, file: res.entry.file,
    size: res.use.size, crc32: res.use.crc, sha256: res.use.sha256, encoding: res.use.encoding,
    evidence: res.copies.map((c) => ({ source: c.source, status: c.status })), transforms: transforms || [res.use.encoding + ' decode', 'crc32 ' + res.use.crc + ' matches manifest', 'parse LLASSET'] };
}
// Saves keep only references; this checks that a saved reference still points at real, intact bytes.
export function verifyProvenance(ar, p) {
  if (!p || !p.recordId) { return false; }
  const idx = ar.all(); const m = idx.messages.get(p.recordId); if (!m) { return false; }
  return m.copies.some((c) => { const r = checkCopy(c, { file: p.file, size: p.size, crc: p.crc32 }); return r.status === 'ok' && r.sha256 === p.sha256; });
}

// ---- asset formats (LLASSET 1) --------------------------------------------------------------------------------
// Reads every complete line; a cut-off file yields what survived and complete=false.
function lines(t) { const s = String(t || ''); const l = s.split('\n'); return /\n$/.test(s) ? l.slice(0, -1) : l.slice(0, -1); }
export function parseBridge(t) {
  const o = { by: null, note: '', span: 0, width: 2.2, rail: 0.95, planks: [], posts: [], complete: false };
  for (const l of lines(t)) { const p = l.trim().split(/\s+/); if (p[0] === 'by') { o.by = p[1]; } else if (p[0] === 'note') { o.note = l.trim().slice(5); } else if (p[0] === 'span') { o.span = +p[1]; } else if (p[0] === 'width') { o.width = +p[1]; } else if (p[0] === 'rail') { o.rail = +p[1]; } else if (p[0] === 'plank' && p.length >= 6) { o.planks.push({ z: +p[1], d: +p[2], tilt: +p[3], side: +p[4], len: +p[5] }); } else if (p[0] === 'post') { o.posts.push(+p[1]); } else if (p[0] === 'end') { o.complete = true; } }
  return o;
}
export function parseWindow(t) {
  const o = { by: null, note: '', width: 1, height: 1.4, points: [], mullions: [], finishes: [], complete: false };
  for (const l of lines(t)) { const p = l.trim().split(/\s+/); if (p[0] === 'by') { o.by = p[1]; } else if (p[0] === 'note') { o.note = l.trim().slice(5); } else if (p[0] === 'width') { o.width = +p[1]; } else if (p[0] === 'height') { o.height = +p[1]; } else if (p[0] === 'point') { o.points.push([+p[1], +p[2]]); } else if (p[0] === 'mullion') { o.mullions.push([+p[1], +p[2], +p[3], +p[4]]); } else if (p[0] === 'finish') { o.finishes = p.slice(1); } else if (p[0] === 'end') { o.complete = true; } }
  return o;
}
export function parseTune(t) {
  const o = { by: null, note: '', tempo: 90, phrases: [], complete: false };
  for (const l of lines(t)) { const p = l.trim().split(/\s+/); if (p[0] === 'by') { o.by = p[1]; } else if (p[0] === 'note') { o.note = l.trim().slice(5); } else if (p[0] === 'tempo') { o.tempo = +p[1]; } else if (p[0] === 'phrase') { o.phrases.push(p.slice(1).map((x) => { const [n, b] = x.split(':'); return { midi: +n, beats: +b }; })); } else if (p[0] === 'end') { o.complete = true; } }
  return o;
}
export function parseLamp(t) {
  const o = { color: 'ffd27a', speed: 0.6, beam: 30, sweep: [], complete: false };
  for (const l of lines(t)) { const p = l.trim().split(/\s+/); if (p[0] === 'color') { o.color = p[1]; } else if (p[0] === 'speed') { o.speed = +p[1]; } else if (p[0] === 'beam') { o.beam = +p[1]; } else if (p[0] === 'sweep') { o.sweep = p.slice(1); } else if (p[0] === 'end') { o.complete = true; } }
  return o;
}
// NPC behaviour script: a list of states; `loop` means the character never leaves; `ending leaves` means she does.
export function parseNpc(t) {
  const o = { name: null, by: null, states: [], loops: false, ending: null, complete: false };
  for (const l of lines(t)) { const p = l.trim().split(/\s+/); if (p[0] === 'LLASSET' && p[2] === 'npc') { o.name = p[3]; } else if (p[0] === 'by') { o.by = p[1]; } else if (p[0] === 'state') { o.states.push({ act: p[1], where: p[2] || null }); } else if (p[0] === 'say') { o.states.push({ act: 'say', key: p[1] }); } else if (p[0] === 'loop') { o.loops = true; } else if (p[0] === 'ending') { o.ending = p[1]; } else if (p[0] === 'end') { o.complete = true; } }
  return o;
}
export const PARSERS = { bridge: parseBridge, window: parseWindow, tune: parseTune, lamp: parseLamp, iris: parseNpc };

// ---- scene graph ---------------------------------------------------------------------------------------------
// The world objects of one era. `restored` holds provenance references from the save: an attached asset that is not
// usable in the public sources appears only if it has been restored (and its record checks out).
// edition: the present-day namespace; CREATED objects appear only there and only once enabled.
export function sceneGraph(ar, era, restored, edition) {
  const pub = ar.publicView(), all = ar.all();
  const b = buildFor(all, era); if (!b) { return { era, build: null, objects: [], credits: [] }; }
  const objects = [];
  for (const a of b.manifest.assets) {
    if (a.kind === 'inline') { objects.push({ id: a.id, assetRef: a.id, era, kind: 'inline', state: 'present', provenance: { recordId: b.messageId, status: STATUS.RECONSTRUCTED, transforms: ['built from the manifest of ' + b.manifest.build] } }); continue; }
    if (a.kind !== 'attach') { continue; }
    // 1998 is a snapshot that only exists on the disk; 2004 is what the public archive holds
    const res = resolveAsset(era === 1998 ? all : pub, era, a.id);
    const r = restored && restored[a.id];
    if (res.status === 'ok') { objects.push({ id: a.id, assetRef: a.id, era, kind: 'attach', state: 'present', data: PARSERS[a.id] ? PARSERS[a.id](res.data) : res.data, provenance: provenance(res) }); continue; }
    if (r && era === 2004) {
      const deep = resolveAsset(all, era, a.id);
      if (deep.status === 'ok' && deep.use.sha256 === r.sha256) { objects.push({ id: a.id, assetRef: a.id, era, kind: 'attach', state: 'restored', data: PARSERS[a.id] ? PARSERS[a.id](deep.data) : deep.data, provenance: provenance(deep) }); continue; }
    }
    objects.push({ id: a.id, assetRef: a.id, era, kind: 'attach', state: 'missing', partial: PARSERS[a.id] && res.partial ? PARSERS[a.id](res.partial) : null, damage: res.copies.map((c) => ({ source: c.source, status: c.status })) });
  }
  // restorations carried forward from the 1998 build into the present edition (lamp, Iris's own ending)
  if (restored && era === 2004) {
    for (const [id, r] of Object.entries(restored)) {
      if (!r || r.era !== 1998) { continue; }
      const res = resolveAsset(all, 1998, id);
      if (res.status !== 'ok' || res.use.sha256 !== r.sha256) { continue; }
      const obj = { id, assetRef: id, era, kind: 'attach', state: 'restored', from: 1998, data: PARSERS[id] ? PARSERS[id](res.data) : res.data, provenance: provenance(res) };
      const i = objects.findIndex((o) => o.id === id); if (i >= 0) { objects[i] = obj; } else { objects.push(obj); }
    }
  }
  if (edition && ar.edition && era === 2004) {
    for (const a of ar.edition.assets) { if (edition[a.id]) { objects.push({ id: a.id, assetRef: a.id, era: 'present', kind: 'created', state: 'present', provenance: { recordId: 'edition:' + ar.edition.build, status: STATUS.CREATED, transforms: ['new work for the restored edition'] } }); } }
  }
  const credits = (edition && edition.credits_restored && ar.edition) ? ar.edition.credits : b.manifest.credits;
  return { era, build: b.manifest.build, manifestId: b.messageId, objects, credits, assets: new Set(objects.filter((o) => o.state !== 'missing').map((o) => o.id)) };
}

// What Restore would do: find an intact copy of the asset as listed by the given build, in any source.
export function restoreCandidate(ar, assetId, era) {
  const res = resolveAsset(ar.all(), era || 2004, assetId);
  return { ok: res.status === 'ok', res, provenance: provenance(res, STATUS.RESTORED) };
}
// Revive: an NPC behaviour from the 1998 record, applied in the present edition.
export function reviveCandidate(ar, npcId) {
  const res = resolveAsset(ar.all(), 1998, npcId);
  return { ok: res.status === 'ok', res, script: res.status === 'ok' ? parseNpc(res.data) : null, provenance: provenance(res, STATUS.RESTORED, [res.use ? res.use.encoding + ' decode' : '', 'from the 1998 summer build', 'parse LLASSET npc']) };
}
export const creditLine = (credits) => credits.map((c) => `${c.who}: ${c.roles.join(' ')}`);
export function fixtureLabelled(ar) { const idx = ar.all(); return [...idx.messages.values()].every((m) => m.copies.every((c) => /fictional/i.test(c.fixture || ''))); }
export const hashText = (t) => sha256(bytes(t));
