// Resurrection V5 tech demo: the same modules the game runs (core/usenet.js, core/archive.js, core/physics.js,
// core/game.js) shown step by step. Raw fixture records -> parse -> build manifests -> the broken 2004 bridge ->
// Restore -> provenance -> the walkable floor changes. A variant input file changes the result.
import * as U from './core/usenet.js';
import * as Ar from './core/archive.js';
import * as Ph from './core/physics.js';
import * as Gm from './core/game.js';
import { CANAL, BRIDGE } from './core/layout.js';

const $ = (id) => document.getElementById(id);
function el(tag, attrs, kids) { const n = document.createElement(tag); Object.entries(attrs || {}).forEach(([k, v]) => { if (v === null || v === undefined) { return; } if (k === 'text') { n.textContent = v; } else if (k === 'class') { n.className = v; } else if (k.startsWith('on')) { n.addEventListener(k.slice(2), v); } else { n.setAttribute(k, v); } }); (kids || []).forEach((c) => c && n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c)); return n; }
const table = (head, rows) => el('table', {}, [el('tr', {}, head.map((h) => el('th', { text: h })))].concat(rows.map((r) => el('tr', {}, r.map((c) => (c instanceof Node ? el('td', {}, [c]) : el('td', { class: /^[<0-9a-f]/.test(String(c)) && String(c).length > 6 ? 'mono' : '', text: String(c) })))))));
const status = (s) => el('span', { class: s === 'ok' ? 'ok' : 'bad', text: s });

const texts = {}; let variant = false, restored = false;
const START = { x: 0, z: 6.6 }, GOAL = { x: 0, z: 12.6 };

async function load() {
  const files = Object.assign({}, Object.fromEntries(Ar.SOURCES.map((s) => [s.id, s.file])), Ar.EXTRA_FILES, { variant: 'variant-missing-plank.spool' });
  await Promise.all(Object.entries(files).map(async ([id, f]) => { const r = await fetch('/v5/data/' + f); if (!r.ok) { throw new Error(f + ' ' + r.status); } texts[id] = await r.text(); }));
}
const archive = () => Ar.createArchive(Object.assign({}, texts, variant ? { disk: texts.variant } : {}));

// The town of the game for one era, with or without the restored bridge, exactly as the game builds it.
function worldOf(ar, era, withRestore) {
  const g = Gm.createGame(ar);
  if (withRestore) { const c = Ar.restoreCandidate(ar, 'bridge', 2004); if (c.ok) { g.s.restored.bridge = c.provenance; } }
  return Gm.worldFor(g, 'town', era);
}
function crossing(w, key) {
  const path = Ph.findPath(w, key, { x: START.x, z: START.z, y: 0 }, GOAL, { reach: 0.6 });
  const mid = Ph.groundAt(w, BRIDGE.x, (CANAL.z0 + CANAL.z1) / 2, 0.5);
  let len = 0; if (path) { for (let i = 1; i < path.length; i++) { len += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); } }
  return { path, len, mid, planks: w.floors.filter((f) => f.plank !== undefined).length };
}
// the widest hole between consecutive planks, in metres
function widestGap(data) {
  if (!data || !data.planks.length) { return null; }
  const p = data.planks.slice().sort((a, b) => a.z - b.z); let best = { gap: 0, at: 0 };
  for (let i = 1; i < p.length; i++) { const gap = p[i].z - (p[i - 1].z + p[i - 1].d); if (gap > best.gap) { best = { gap, at: p[i - 1].z + p[i - 1].d }; } }
  return best;
}

// ---- top-down map of the canal crossing ---------------------------------------------------------------------
function drawMap(cv, w, ghost, res, label) {
  const ctx = cv.getContext('2d'); const W = cv.width, H = cv.height; const X0 = -4.2, X1 = 4.2, Z0 = 5.4, Z1 = 13.6;
  const px = (x) => ((x - X0) / (X1 - X0)) * W, pz = (z) => H - ((z - Z0) / (Z1 - Z0)) * H;
  ctx.fillStyle = '#0a090e'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#1d4a6e'; ctx.fillRect(0, pz(CANAL.z1), W, pz(CANAL.z0) - pz(CANAL.z1));
  ctx.fillStyle = '#7fc4ff'; ctx.font = '12px monospace'; ctx.fillText('canal (water: no floor)', 6, pz(CANAL.z1) + 14);
  for (const f of w.floors) {
    ctx.fillStyle = f.plank !== undefined ? '#ffd27a' : '#4a4456';
    if (f.k === 'rect') { ctx.fillRect(px(f.x0), pz(f.z1), px(f.x1) - px(f.x0), pz(f.z0) - pz(f.z1)); }
    else if (f.k === 'circ') { ctx.beginPath(); ctx.arc(px(f.x), pz(f.z), (f.r / (X1 - X0)) * W, 0, Math.PI * 2); ctx.fill(); }
  }
  if (ghost && ghost.planks.length) { ctx.strokeStyle = 'rgba(255,138,122,.9)'; ctx.setLineDash([4, 3]); ghost.planks.forEach((p) => { const z0 = BRIDGE.z0 + p.z, z1 = z0 + p.d; ctx.strokeRect(px(BRIDGE.x - BRIDGE.halfWalk), pz(z1), px(BRIDGE.x + BRIDGE.halfWalk) - px(BRIDGE.x - BRIDGE.halfWalk), pz(z0) - pz(z1)); }); ctx.setLineDash([]); }
  if (res.path) { ctx.strokeStyle = '#9be39b'; ctx.lineWidth = 3; ctx.beginPath(); res.path.forEach(([x, z], i) => (i ? ctx.lineTo(px(x), pz(z)) : ctx.moveTo(px(x), pz(z)))); ctx.stroke(); ctx.lineWidth = 1; }
  const dot = (p, c, t) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(px(p.x), pz(p.z), 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#efe9dc'; ctx.fillText(t, px(p.x) + 10, pz(p.z) + 4); };
  dot(START, '#efe9dc', 'Mara'); dot(GOAL, '#c79bff', 'Theo');
  ctx.fillStyle = res.path ? '#9be39b' : '#ff8a7a'; ctx.font = 'bold 13px monospace'; ctx.fillText(label + (res.path ? '  path found' : '  no path'), 6, 16);
}

// ---- the page ----------------------------------------------------------------------------------------------------
const sec = {};
function section(id, title, sub) { const s = el('section', { id: 'sec-' + id, 'data-testid': 'sec-' + id }, [el('h2', {}, [title + ' ', el('small', { text: sub || '' })])]); sec[id] = s; return s; }
function render() {
  const ar = archive(); const all = ar.all(), pub = ar.publicView(); const main = $('main'); main.textContent = '';
  // 1 raw records
  const s1 = section('raw', '1 · Raw records', '原始记录 (rnews spool + mbox)');
  s1.append(table(['source', 'file', 'bytes', 'articles', 'rejected'], Ar.SOURCES.map((s) => { const t = ar.texts[s.id]; return [s.id + (s.public ? '' : ' (Elena’s backup)'), s.id === 'disk' && variant ? 'variant-missing-plank.spool' : s.file, t.length, U.splitSpool(t).length, all.rejected.filter((r) => r.source === s.id).length]; })));
  const bridgeEntry = (Ar.buildFor(all, 2004) || Ar.buildFor(all, 1998)).manifest.assets.find((a) => a.id === 'bridge');
  const bm = all.messages.get(bridgeEntry.messageId); const rawCopy = bm.copies.find((c) => c.source === 'mirror') || bm.copies[0];
  const rawLines = rawCopy.raw.split('\n'); s1.append(el('div', { class: 'note', text: `The post that carries bridge.ll, as stored on ${rawCopy.source}:` }), el('pre', { 'data-testid': 'raw', text: rawLines.slice(0, 26).join('\n') + (rawLines.length > 26 ? `\n… (${rawLines.length - 26} more lines)` : '') }));
  main.append(s1);
  // 2 parse
  const s2 = section('parse', '2 · Parse', '解析: Message-ID, References, cancels, conflicts');
  const thread = U.thread(all, bm.id);
  s2.append(el('div', { class: 'note', text: 'The bridge thread, following References:' }), table(['Message-ID', 'in index', 'From', 'Subject'], thread.map((r) => { const m = all.messages.get(r.id); return [r.id, r.present ? 'yes' : 'missing', m ? m.head.from.split(' <')[0] : '—', m ? m.head.subject : '—']; })));
  s2.append(el('div', { class: 'note', text: `Copies of ${bm.id}: ` + bm.copies.map((c) => c.source).join(', ') + (bm.conflict ? '  (bodies differ: conflict kept side by side)' : '') }));
  s2.append(el('div', { class: 'note', text: 'Cancel control messages (applied only in the source that carried them):' }), table(['source', 'cancels', 'by'], all.cancels.map((c) => [c.source, c.target, c.by.split(' <')[0]])));
  s2.append(el('div', { class: 'note', text: 'Conflicting copies:' }), table(['Message-ID', 'variants', 'sources'], all.conflicts.map((c) => [c.id, c.variants, c.sources.join(', ')])));
  s2.append(el('div', { class: 'note', text: `${all.messages.size} live messages · ${all.missing.size} referenced but missing · ${all.rejected.length} rejected records` }));
  main.append(s2);
  // 3 manifests
  const s3 = section('manifest', '3 · Build manifests', '构建清单: which objects exist in 1998 and 2004');
  for (const era of [1998, 2004]) {
    const bAll = Ar.buildFor(all, era), bPub = Ar.buildFor(pub, era);
    s3.append(el('div', { class: 'note' }, [el('b', { text: `${era} · ${Ar.ERA_BUILD[era]}` }), ` — manifest ${bAll ? bAll.messageId : 'not found'} · found in: ${bAll ? bAll.sources.join(', ') : '—'}` + (bAll && !bPub ? ' (cancelled in the public mirror; only Elena’s disk still has it)' : '')]));
    if (bAll) { s3.append(table(['asset', 'kind', 'file', 'size', 'crc32'], bAll.manifest.assets.map((a) => [a.id, a.kind, a.file || '', a.size || '', a.crc || '']))); }
  }
  main.append(s3);
  // 4 broken bridge
  const s4 = section('broken', '4 · The 2004 bridge in the public archive', '公开档案里的 2004 桥');
  const r04 = Ar.resolveAsset(pub, 2004, 'bridge'); const ghost = r04.partial ? Ar.parseBridge(r04.partial) : null;
  s4.append(table(['source', 'copy status', 'bytes', 'crc32', 'manifest wants'], r04.copies.map((c) => [c.source, status(c.status), c.size, c.crc || '—', `${r04.entry.size} B · ${r04.entry.crc}`])));
  s4.append(el('p', { class: 'verdict ' + (r04.status === 'ok' ? 'ok' : 'bad'), 'data-testid': 'broken-verdict', text: r04.status === 'ok' ? 'An intact copy exists.' : `No intact copy in the public sources → the bridge is not in the 2004 scene graph. Surviving fragment: ${ghost ? ghost.planks.length : 0} planks (drawn dashed, not walkable).` }));
  main.append(s4);
  // 5 restore and collision
  const s5 = section('restore', '5 · Restore → provenance → walkable floor', '修复 → 来源 → 可行走地面');
  const cand = Ar.restoreCandidate(ar, 'bridge', 2004);
  const w04 = worldOf(ar, 2004, restored && cand.ok), w98 = worldOf(ar, 1998, false);
  const c04 = crossing(w04, 'tech04' + variant + restored), c98 = crossing(w98, 'tech98' + variant);
  if (!restored) { s5.append(el('p', { class: 'note', text: 'Press “Restore bridge”. Restore searches every source, including Elena’s backup disk, for a copy whose size and CRC-32 match the 2004 manifest.' })); }
  else if (cand.ok) {
    const p = cand.provenance;
    s5.append(el('p', { class: 'verdict ok', 'data-testid': 'restore-verdict', text: `RESTORED from ${p.source}: ${p.file}, ${p.size} bytes` }), table(['field', 'value'], [['record', p.recordId], ['manifest', p.manifestId], ['status', p.status], ['encoding', p.encoding], ['CRC-32', p.crc32], ['SHA-256', p.sha256], ['transforms', p.transforms.join(' → ')], ['all copies', p.evidence.map((e) => e.source + ': ' + e.status).join(' · ')]]));
  } else {
    s5.append(el('p', { class: 'verdict bad', 'data-testid': 'restore-verdict', text: 'RESTORE REFUSED: no copy in any source matches the 2004 manifest.' }), table(['source', 'status', 'bytes', 'crc32', 'wanted'], cand.res.copies.map((c) => [c.source, status(c.status), c.size, c.crc || '—', `${cand.res.entry.size} B · ${cand.res.entry.crc}`])));
  }
  const cv04 = el('canvas', { width: '520', height: '420', 'data-testid': 'map-2004' }), cv98 = el('canvas', { width: '520', height: '420', 'data-testid': 'map-1998' });
  const line = (c, era) => `${era}: ${c.planks} plank floors · ground at bridge centre: ${c.mid ? 'y=' + c.mid.y.toFixed(2) : 'none (water)'} · path Mara→Theo: ${c.path ? c.len.toFixed(1) + ' m' : 'none'}`;
  s5.append(el('div', { class: 'note', 'data-testid': 'floor-2004', text: line(c04, '2004 (present edition)') }), cv04, el('div', { class: 'note', 'data-testid': 'floor-1998', text: line(c98, '1998 (snapshot from the disk, never edited)') }), cv98);
  const g98 = widestGap(Ar.sceneGraph(ar, 1998).objects.find((o) => o.id === 'bridge')?.data);
  if (g98 && g98.gap > 0.2) { s5.append(el('p', { class: 'note bad', 'data-testid': 'gap', text: `1998 bridge from this input has a ${g98.gap.toFixed(2)} m hole at z+${g98.at.toFixed(2)}: walking stops at the edge; in the game a jump clears it.` })); }
  s5.append(el('div', { class: 'legend' }, [el('span', {}, [el('span', { class: 'sw', style: 'background:#4a4456' }), 'floor']), el('span', {}, [el('span', { class: 'sw', style: 'background:#ffd27a' }), 'plank floor (from bridge.ll)']), el('span', {}, [el('span', { class: 'sw', style: 'border:1px dashed #ff8a7a' }), 'surviving fragment, not walkable']), el('span', {}, [el('span', { class: 'sw', style: 'background:#9be39b' }), 'path found by the game’s path finder'])]));
  main.append(s5);
  drawMap(cv04, w04, restored && cand.ok ? null : ghost, c04, '2004'); drawMap(cv98, w98, null, c98, '1998');
  window.V5Tech = { variant, restored, restoreOk: cand.ok, path2004: !!c04.path, path1998: !!c98.path, planks2004: c04.planks, planks1998: c98.planks, fixture: Ar.fixtureLabelled(ar) };
  $('variant').setAttribute('aria-pressed', String(variant));
}

// ---- 3-minute walkthrough --------------------------------------------------------------------------------------
const STEPS = [[0, 'raw'], [25, 'parse'], [55, 'manifest'], [80, 'broken'], [105, 'restore', () => { restored = true; render(); }], [140, 'restore', () => { variant = true; render(); }], [165, 'restore', () => { variant = false; render(); }]];
let run = null;
function focus(id) { Object.values(sec).forEach((s) => s.classList.remove('now')); const s = sec[id]; if (s) { s.classList.add('now'); s.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }
function play() {
  if (run) { clearInterval(run.iv); run = null; $('play').textContent = '▶ 3-minute walkthrough'; $('timer').textContent = ''; return; }
  variant = false; restored = false; render(); const t0 = performance.now(); let next = 0; $('play').textContent = '■ stop';
  run = { iv: setInterval(() => {
    const t = (performance.now() - t0) / 1000; $('timer').textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')} / 3:00`;
    while (next < STEPS.length && t >= STEPS[next][0]) { const [, id, fn] = STEPS[next]; if (fn) { fn(); } focus(id); next += 1; }
    if (t > 180) { play(); }
  }, 250) };
}
$('play').addEventListener('click', play);
$('restore').addEventListener('click', () => { restored = true; render(); focus('restore'); });
$('reset').addEventListener('click', () => { restored = false; variant = false; render(); });
$('variant').addEventListener('click', () => { variant = !variant; render(); focus('restore'); });
load().then(render).catch((e) => { $('main').textContent = 'Could not load the fixture archive: ' + e.message; });
