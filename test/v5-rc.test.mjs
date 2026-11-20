// RC1 tooling: key bindings, frame-time statistics, the playtest recorder (consent, pauses, exits, chapter times), the
// preview saves, the single-file bundle and the local server. None of this needs a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const store = new Map();
let clock = 1_700_000_000_000;
Date.now = () => clock;
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const listeners = {};
globalThis.window = { __V5_PLAYTEST__: true, addEventListener: (k, f) => { (listeners[k] = listeners[k] || []).push(f); } };
globalThis.document = { visibilityState: 'visible', addEventListener: (k, f) => { (listeners['doc:' + k] = listeners['doc:' + k] || []).push(f); } };

const K = await import('../frontend/v5/core/keymap.js');
const B = await import('../frontend/v5/core/bench.js');
const PT = await import('../frontend/v5/playtest.js');
const Gm = await import('../frontend/v5/core/game.js');

// ---- key bindings ---------------------------------------------------------------------------------------------------
test('keymap: defaults are complete, with one key per action', () => {
  assert.equal(Object.keys(K.DEFAULT_KEYS).length, K.ACTIONS.length);
  assert.equal(new Set(Object.values(K.DEFAULT_KEYS)).size, K.ACTIONS.length);
  K.ACTIONS.forEach((a) => assert.equal(K.isReserved(K.DEFAULT_KEYS[a]), false, a));
});
test('keymap: binding a key that another action uses swaps them, so no key does two things', () => {
  const r = K.rebind(K.DEFAULT_KEYS, 'forward', 'KeyD');
  assert.equal(r.ok, true); assert.equal(r.swappedWith, 'right');
  assert.equal(r.keys.forward, 'KeyD'); assert.equal(r.keys.right, 'KeyW');
  assert.equal(new Set(Object.values(r.keys)).size, K.ACTIONS.length);
  assert.equal(K.DEFAULT_KEYS.forward, 'KeyW', 'the input map is not changed');
});
test('keymap: a free key is simply bound; the same key again is a no-op', () => {
  const r = K.rebind(K.DEFAULT_KEYS, 'jump', 'KeyK'); assert.equal(r.ok, true); assert.equal(r.swappedWith, null); assert.equal(r.keys.jump, 'KeyK');
  const again = K.rebind(r.keys, 'jump', 'KeyK'); assert.equal(again.ok, true); assert.equal(again.swappedWith, null);
});
test('keymap: keys the game needs cannot be bound', () => {
  ['Escape', 'F3', 'F5', 'Digit1', 'Digit2', 'Digit3', 'MetaLeft', 'OSRight', 'ContextMenu'].forEach((c) => { const r = K.rebind(K.DEFAULT_KEYS, 'use', c); assert.equal(r.ok, false, c); assert.equal(r.reason, 'reserved'); assert.deepEqual(r.keys, K.DEFAULT_KEYS); });
  assert.equal(K.rebind(K.DEFAULT_KEYS, 'use', 'Digit4').ok, true, 'other digits are fine');
  assert.equal(K.rebind(K.DEFAULT_KEYS, 'nope', 'KeyJ').ok, false);
});
test('keymap: stored bindings that are malformed, reserved or duplicated fall back to the defaults', () => {
  assert.deepEqual(K.sanitizeKeys(null).keys, K.DEFAULT_KEYS);
  assert.deepEqual(K.sanitizeKeys('x').keys, K.DEFAULT_KEYS);
  assert.deepEqual(K.sanitizeKeys({ forward: 'KeyI' }).keys, Object.assign({}, K.DEFAULT_KEYS, { forward: 'KeyI' }));
  const bad = K.sanitizeKeys({ forward: 'Escape', back: 5, left: '<script>', jump: 'KeyK' });
  assert.equal(bad.repaired, true); assert.equal(bad.keys.forward, 'KeyW'); assert.equal(bad.keys.back, 'KeyS'); assert.equal(bad.keys.left, 'KeyA'); assert.equal(bad.keys.jump, 'KeyK');
  const dup = K.sanitizeKeys({ forward: 'KeyD' });   // D is also "right"
  assert.equal(dup.repaired, true); assert.deepEqual(dup.keys, K.DEFAULT_KEYS);
  assert.deepEqual(K.sanitizeKeys({ __proto__: { forward: 'KeyZ' } }).keys, K.DEFAULT_KEYS);
});

// ---- frame-time statistics ------------------------------------------------------------------------------------------
test('bench: summary of frame times', () => {
  const s = B.summarize([16, 16, 16, 16, 40, 16]);
  assert.equal(s.frames, 6); assert.equal(s.worstMs, 40); assert.equal(s.avgFps, 50); assert.equal(s.low1Fps, 25);
  assert.equal(s.hitches, 0); assert.equal(B.summarize([20, 120, 300]).hitches, 2); assert.equal(B.summarize([20, 120, 300]).severe, 1);
  const flat = B.summarize(new Array(1000).fill(16.7)); assert.equal(flat.avgFps, 59.9); assert.equal(flat.low1Fps, 59.9);
  const spiky = B.summarize(new Array(990).fill(10).concat(new Array(10).fill(100))); assert.equal(spiky.low1Fps, 10, 'the slowest 1% of 1000 frames is 10 frames of 100 ms');
  assert.equal(B.summarize([]).frames, 0);
});
test('bench: refresh rate from idle frames, bench address parsing, markdown report', () => {
  assert.equal(B.refreshHz([16.6, 16.7, 16.7, 33.3, 16.6]), 60); assert.equal(B.refreshHz([8.3, 8.4, 8.3]), 120); assert.equal(B.refreshHz([]), null);
  assert.equal(B.parseBench(''), null); assert.equal(B.parseBench('?preview=end'), null);
  const p = B.parseBench('?bench=low,nonsense,high&secs=3&beats=1.town,end&run=a b!c');
  assert.deepEqual(p.tiers, ['low', 'high']); assert.deepEqual(p.beats, ['1.town', 'end']); assert.equal(p.secs, 3); assert.equal(p.run, 'abc');
  assert.deepEqual(B.parseBench('?bench=').tiers, ['high']); assert.equal(B.parseBench('?bench=low&secs=9999').secs, 60);
  assert.ok(B.benchUrl('/v5/', p).startsWith('/v5/?bench=low%2Chigh'));
  const md = B.markdown({ build: 'abc1234', when: '2026-11-19T10:00:00Z', readyMs: 900, device: { browser: 'Chrome 142', gpu: 'Apple M2', screen: [1512, 982], dpr: 2, refreshHz: 120, cores: 8 }, results: [{ tier: 'high', beat: '1.town', loadMs: 400, stats: B.summarize([8, 8, 9, 40]), heapMB: 120, calls: 300, triangles: 90000 }, { tier: 'low', beat: '1.town', loadMs: 300, stats: B.summarize([8, 8, 8]), heapMB: null }] });
  assert.match(md, /Chrome 142 · Apple M2/); assert.match(md, /\| high \| 1\.town \|/); assert.match(md, /n\/a/); assert.match(md, /Lowest scene 1% low FPS/);
  assert.equal(B.browserName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'), 'Safari 18.1');
  assert.equal(B.browserName('Mozilla/5.0 Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0'), 'Edge 142');
});

// ---- the playtest recorder ------------------------------------------------------------------------------------------
test('playtest: nothing is recorded or stored before the player presses Start or Continue', () => {
  assert.equal(PT.active(), true);
  PT.start({ userAgent: 'x', gpu: 'g' });
  PT.input('keyboard'); PT.beat('1.study', 1); PT.frame(16, true, null, true); PT.event({ type: 'hint' }); PT.pause();
  assert.equal(PT.recording(), false); assert.equal(PT.summary(), null);
  assert.equal(store.has('v5.playtest.v1'), false, 'no log is written before consent');
});
test('playtest: chapter start and end times, pauses, exits, hints, skips and the approximate 1% low', () => {
  PT.begin('P01'); assert.equal(PT.recording(), true);
  PT.input('keyboard'); PT.beat('1.study', 1);
  for (let i = 0; i < 300; i++) { PT.frame(i % 100 === 0 ? 120 : 16, true, { x: 1, z: 2, dialog: null, choice: null, prompt: null }, true); clock += 16; }
  PT.event({ type: 'hint' }); PT.hintKey(); PT.skipped(); PT.event({ type: 'retry' });
  clock += 5000; PT.pause(); clock += 90_000; PT.resume();
  clock += 1000; PT.beat('2.train', 2);
  for (let i = 0; i < 100; i++) { PT.frame(16, true, { x: 1, z: 2 }, true); clock += 16; }
  PT.rate(1, 4, 3, 'ok'); window.__x = 1;
  document.visibilityState = 'hidden'; listeners['doc:visibilitychange'].forEach((f) => f());
  listeners.pagehide.forEach((f) => f());
  const s = PT.summary();
  assert.equal(s.tester, 'P01'); assert.equal(s.version, 2);
  assert.ok(s.chapters[1].startedAt && s.chapters[1].endedAt && s.chapters[2].startedAt, 'wall-clock start and end per chapter');
  assert.equal(s.totals.pauses, 1); assert.equal(s.totals.pauseMinutes, 1.5);
  assert.equal(s.totals.hintsShown, 1); assert.equal(s.totals.hintKeyPresses, 1); assert.equal(s.totals.skippedLines, 1); assert.equal(s.totals.retries, 1);
  assert.equal(s.totals.exits, 1); assert.equal(s.exits[0].beat, '2.train'); assert.equal(s.exits[0].reason, 'pagehide'); assert.equal(s.totals.tabSwitches, 1);
  assert.ok(s.totals.low1FpsApprox > 7 && s.totals.low1FpsApprox < 12, 'slowest 1% are the 120 ms frames: ' + s.totals.low1FpsApprox);
  assert.equal(s.beats['1.study'].chapter, 1); assert.equal(s.ratings[1].fun, 4);
  assert.ok(!/name|email|@/i.test(JSON.stringify(Object.keys(s))), 'no personal fields');
  assert.equal(s.totals.minutes < 1, true, 'play time excludes the pause');
});
test('playtest: an unfinished record is resumed, "delete my record" removes it and switches recording off', () => {
  assert.ok(store.has('v5.playtest.v1'));
  PT.reset(); assert.equal(PT.recording(), false); assert.equal(store.has('v5.playtest.v1'), false); assert.equal(store.has('v5.playtest.v1.on'), false, 'no persistent recorder switch');
  PT.beat('1.town', 1); PT.frame(16, true, null, true); assert.equal(store.has('v5.playtest.v1'), false, 'nothing is written after deleting');
  PT.begin('P02'); PT.beat('1.study', 1); PT.finish(); assert.equal(PT.summary().finished, true);
});

// ---- preview saves --------------------------------------------------------------------------------------------------
test('preview saves: one valid save per beat, and the file is what the current code produces', async () => {
  const { makeSaves, FILE } = await import('../tools/v5-preview-saves.mjs'); const { loadArchive } = await import('../tools/v5-playthrough.mjs');
  const made = JSON.stringify(await makeSaves()) + '\n'; assert.equal(fs.readFileSync(FILE, 'utf8'), made, 'run: node tools/v5-preview-saves.mjs');
  const ar = loadArchive(); const j = JSON.parse(made);
  Gm.BEATS.forEach((b) => { const s = Gm.parseSave(j.saves[b], ar); assert.ok(s, b); assert.equal(s.beat, b); });
  const snow = Gm.parseSave(j.saves.snow, ar); assert.ok(snow); assert.equal(snow.beat, '7.town'); assert.equal(snow.season, 'winter'); assert.ok(snow.edition.pier_walk && snow.edition.seasons, 'the snow preview is the finished winter pier');
  const { SCENES } = await import('../frontend/v5/rc-scenes.js');
  SCENES.forEach((sc) => { assert.ok(j.saves[sc.beat], sc.beat); for (let i = 1; i <= sc.imgs; i++) { assert.ok(fs.existsSync(path.join(root, 'frontend/v5/rc/shots', `${sc.shot || sc.beat}-${i}.jpg`)), `${sc.shot || sc.beat}-${i}.jpg`); } });
  assert.deepEqual(['2.train', '3.ride', '3.beam', '4.porch', '6.beach', 'snow'].filter((b) => !SCENES.some((x) => x.beat === b)), [], 'the six key scenes are all in the hub');
});

// ---- single-file bundle ---------------------------------------------------------------------------------------------
test('bundle: the scripts compile as classic scripts and the html files open without a server', async () => {
  const { buildAll, bundleGame } = await import('../tools/v5-bundle.mjs');
  const code = bundleGame(); assert.ok(code.length > 1_000_000); assert.doesNotThrow(() => new vm.Script(code));
  assert.ok(!/^\s*(import|export)\s/m.test(code.replace(/^__defs.*$/gm, '')), 'no module syntax left outside strings');
  const out = path.join(root, 'dist', '.test-bundle'); const r = buildAll(out);
  try {
    ['Resurrection-V5.html', 'Resurrection-V5-Playtest.html', 'Resurrection-V5-Audio.html', 'Resurrection-V5-RC.html', 'Resurrection-V5-Start.html', 'Resurrection-V5-Tech.html'].forEach((f) => {
      assert.ok(r.files.includes(f), f); const html = fs.readFileSync(path.join(out, f), 'utf8');
      assert.ok(!/type="module"/.test(html), f + ' has no module script'); assert.ok(!/src="\/v5\//.test(html), f + ' does not load from /v5/');
      const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]); assert.equal(scripts.length, 1, f); assert.doesNotThrow(() => new vm.Script(scripts[0]), f);
      assert.match(html, /window\.__V5_STANDALONE__ = true/); assert.equal(/__V5_PLAYTEST__ = true/.test(html), f === 'Resurrection-V5-Playtest.html', f);
    });
    const game = fs.readFileSync(path.join(out, 'Resurrection-V5.html'), 'utf8');
    assert.match(game, /\/v5\/data\/preview-saves\.json/); assert.match(game, /\/v5\/data\/skylark-backup\.spool/);
    assert.ok(fs.existsSync(path.join(out, 'shots', 'end-1.jpg'))); assert.ok(r.files.includes('feedback-form.html'));
    // every page the start page, the hub and the audio page link to exists next to them
    const linked = new Set(); ['home.js', 'rc.js', 'audio-check.js'].forEach((f) => { [...fs.readFileSync(path.join(root, 'frontend/v5', f), 'utf8').matchAll(/'((?:Resurrection-V5[A-Za-z-]*|feedback-form)\.html)/g)].forEach((m) => linked.add(m[1])); });
    assert.ok(linked.size >= 6, [...linked].join()); linked.forEach((f) => assert.ok(fs.existsSync(path.join(out, f)), 'linked page exists: ' + f));
    const start = fs.readFileSync(path.join(out, 'Resurrection-V5-Start.html'), 'utf8'); ['home-start', 'home-continue', 'home-tech', 'home-audio', 'home-scenes', 'home-feedback'].forEach((id) => assert.ok(start.includes('data-testid="' + id + '"'), id));
    assert.ok(!/href="\/v5\//.test(fs.readFileSync(path.join(out, 'Resurrection-V5-Tech.html'), 'utf8')), 'the technical demo does not link back to a server path');
    assert.ok(!/https?:\/\/(?!www\.w3\.org|threejs\.org|github\.com\/mrdoob)/.test(game.replace(/<style>[\s\S]*?<\/style>/, '').split('__req("frontend/p4/vendor')[0]), 'no web addresses in the game code');
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
test('bundle: the bundler refuses syntax it does not understand', async () => {
  const { bundleModules } = await import('../tools/v5-bundle.mjs'); const tmp = path.join(root, 'dist', '.test-bad'); fs.mkdirSync(tmp, { recursive: true });
  try {
    fs.writeFileSync(path.join(tmp, 'a.js'), "import b from './b.js';\nexport const a = b;\n"); fs.writeFileSync(path.join(tmp, 'b.js'), 'export default 1;\n');
    assert.throws(() => bundleModules('dist/.test-bad/a.js'), /unsupported import form|unhandled module syntax/);
    fs.writeFileSync(path.join(tmp, 'a.js'), "import { zzz } from './b.js';\n"); fs.writeFileSync(path.join(tmp, 'b.js'), 'export const yyy = 1;\n');
    assert.throws(() => bundleModules('dist/.test-bad/a.js'), /does not export zzz/);
    fs.writeFileSync(path.join(tmp, 'a.js'), "import { b } from './b.js';\nexport const a = 1;\n"); fs.writeFileSync(path.join(tmp, 'b.js'), "import { a } from './a.js';\nexport const b = 1;\n");
    assert.throws(() => bundleModules('dist/.test-bad/a.js'), /cycle/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

// ---- local server ---------------------------------------------------------------------------------------------------
test('server: serves the game and the review pages read-only, nothing outside them', async () => {
  const { server, fileFor } = await import('../tools/v5-serve.mjs');
  assert.equal(fileFor('/etc/passwd'), null); assert.equal(fileFor('/v5/../../etc/passwd'), null); assert.equal(fileFor('/api/health'), null);
  assert.ok(fileFor('/v5/rc').endsWith(path.join('frontend', 'v5', 'rc.html')));
  await new Promise((r) => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
  const get = (p, method = 'GET') => new Promise((res, rej) => { const q = http.request({ host: '127.0.0.1', port, path: p, method }, (resp) => { let b = ''; resp.on('data', (c) => { b += c; }); resp.on('end', () => res({ status: resp.statusCode, type: resp.headers['content-type'], csp: resp.headers['content-security-policy'], body: b })); }); q.on('error', rej); q.end(); });
  try {
    const rc = await get('/v5/rc'); assert.equal(rc.status, 200); assert.match(rc.type, /text\/html/); assert.match(rc.csp, /default-src 'self'/);
    assert.equal((await get('/v5/')).status, 200); assert.equal((await get('/v5/audio')).status, 200); assert.equal((await get('/v5/rc.js')).status, 200);
    assert.equal((await get('/v5/data/preview-saves.json')).status, 200); assert.equal((await get('/p4/vendor/three.module.min.js')).status, 200);
    assert.match(JSON.parse((await get('/v5/data/build.json')).body).build, /./);
    const home = await get('/'); assert.equal(home.status, 200); assert.match(home.body, /home-start/); assert.equal((await get('/v5/home')).status, 200);
    const form = await get('/v5/feedback'); assert.equal(form.status, 200); assert.match(form.body, /Resurrection V5/);
    assert.equal((await get('/backend/package.json')).status, 404); assert.equal((await get('/v5/core')).status, 404); assert.equal((await get('/v5/', 'POST')).status, 405);
  } finally { await new Promise((r) => server.close(r)); }
});

// ---- the feedback form and the privacy promises ---------------------------------------------------------------------
test('feedback form: static page that saves a file on the player\'s computer and sends nothing', () => {
  const f = fs.readFileSync(path.join(root, 'docs/playtest/feedback-form.html'), 'utf8');
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|<form[^>]*\saction=|<img|<script[^>]*\ssrc=|https?:\/\//i.test(f.replace(/<!--[\s\S]*?-->/g, '')), 'no network code and no web addresses');
  assert.match(f, /Every question is optional/); assert.match(f, /do not enter your name/);
});
test('privacy: the game and the recorder contain no network sends', () => {
  ['frontend/v5/playtest.js', 'frontend/v5/main.js', 'frontend/v5/home.js', 'frontend/v5/rc.js'].forEach((f) => {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    assert.ok(!/sendBeacon|XMLHttpRequest|WebSocket|navigator\.share|method:\s*['"]POST/i.test(src), f + ' sends nothing');
    // the only fetches are for the game\'s own data files, the preview saves and the build id
    [...src.matchAll(/fetch\(([^)]*)\)/g)].forEach((m) => assert.match(m[1], /\/v5\/data\//, f + ': ' + m[0]));
  });
});
