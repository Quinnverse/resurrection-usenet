// R4 verification in real Chromium (headless, software GPU). Plays with the real keyboard (page.keyboard: W A S D,
// E, 1/2, Space), the way a person would: it reads only what is on screen or in the snapshot a person could see
// (positions, the HUD line), never sets game state. Writes screenshots and results.json to docs/r4-evidence/browser.
//
//   node tools/r4-browser.mjs                 every check
//   node tools/r4-browser.mjs prologue beam   only some (prologue, prologue-zh, chase, cameras, beam, town-beam, epilogue, chain)
//
// Starts tools/v5-serve.mjs on a free port and stops it at the end. Needs `npx playwright install chromium`.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('docs/r4-evidence/browser'); fs.mkdirSync(OUT, { recursive: true });
const PORT = 8000 + Math.floor(Math.random() * 900);
const only = process.argv.slice(2);
const want = (name) => !only.length || only.includes(name);
const results = []; const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const srv = spawn('node', ['tools/v5-serve.mjs', '--port', String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });

async function open(query, lang) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: lang === 'zh' ? 'zh-CN' : 'en-US' });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message))); page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); } });
  await page.goto(`http://127.0.0.1:${PORT}/v5/${query || ''}`);
  return { page, ctx, errors };
}
const snap = (page) => page.evaluate(() => window.V5Debug.snapshot());
const shot = async (page, name) => { const f = path.join(OUT, name + '.jpg'); await page.screenshot({ path: f, type: 'jpeg', quality: 72 }); return path.relative(process.cwd(), f); };
const wait = (page, ms) => page.waitForTimeout(ms);
async function until(page, fn, ms, every) { const t0 = Date.now(); for (;;) { const s = await snap(page).catch(() => null); if (s && fn(s)) { return s; } if (Date.now() - t0 > ms) { throw new Error('timed out: ' + JSON.stringify(s && { beat: s.beat, prompt: s.prompt, dialog: s.dialog && s.dialog.id, x: s.x, z: s.z })); } await wait(page, every || 150); } }
// start a new game from the title screen
async function startNew(page) { await page.getByTestId('start').waitFor({ timeout: 60000 }); await page.keyboard.press('Enter'); await until(page, (s) => s.beat && s.mode === 'play', 30000); }
// press keys for a short moment toward a world position, as a person nudging W/A/S/D would
async function step(page, x, z, ms) {
  const s = await snap(page); const dx = x - s.x, dz = z - s.z; const d = Math.hypot(dx, dz) || 1;
  const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw), rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw);
  const mz = (dx * fx + dz * fz) / d, mx = (dx * rx + dz * rz) / d; const keys = [];
  if (mz > 0.38) { keys.push('KeyW'); } if (mz < -0.38) { keys.push('KeyS'); } if (mx > 0.38) { keys.push('KeyD'); } if (mx < -0.38) { keys.push('KeyA'); }
  for (const k of keys) { await page.keyboard.down(k); } await wait(page, ms || 110); for (const k of keys) { await page.keyboard.up(k); }
  return d;
}
// a person walks around the table, not through it: go by these points first, then to (x, z)
async function walkVia(page, pts, fn, ms) { for (const [x, z] of pts) { const t0 = Date.now(); for (;;) { const s = await snap(page); if (fn(s)) { return s; } if (s.dialog || s.choice) { await talk(page); continue; } if (Math.hypot(s.x - x, s.z - z) < 0.45 || Date.now() - t0 > 12000) { break; } await step(page, x, z); } } return null; }
async function walkUntil(page, x, z, fn, ms) { const t0 = Date.now(); for (;;) { const s = await snap(page); if (fn(s)) { return s; } if (s.dialog || s.choice) { await talk(page); continue; } if (Date.now() - t0 > (ms || 30000)) { throw new Error(`walk to ${x},${z} timed out at ${s.beat} (${s.x.toFixed(2)},${s.z.toFixed(2)}) prompt=${JSON.stringify(s.prompt)}`); } await step(page, x, z); } }
const promptIs = (id) => (s) => !s.dialog && s.prompt && s.prompt.id === id;
// read the conversation with E; choose with the number keys
async function talk(page, picks, onLine) {
  for (let i = 0; i < 400; i++) {
    const s = await snap(page); const ch = s.choice || (s.dialog && !Array.isArray(s.dialog.line) ? s.dialog.line : null);
    if (!s.dialog && !s.choice) { return; }
    if (onLine) { await onLine(s); }
    if (ch) { const id = ch.id || ch.choice; const k = picks && picks[id] !== undefined ? picks[id] : 0; await page.keyboard.press('Digit' + (k + 1)); await wait(page, 350); continue; }
    if (Array.isArray(s.dialog.line) && s.dialog.line[0] === 'pause') { await wait(page, 300); continue; }
    await page.keyboard.press('KeyE'); await wait(page, 330);
  }
  throw new Error('conversation did not end');
}
async function holdE(page, done, ms) { await page.keyboard.down('KeyE'); try { await until(page, done, ms || 15000, 100); } finally { await page.keyboard.up('KeyE'); } }
async function record(name, fn) {
  const t0 = Date.now(); const r = { name, ok: false, shots: [], notes: [] };
  try { await fn(r); r.ok = true; } catch (e) { r.error = String(e && e.message || e).slice(0, 600); }
  r.seconds = Math.round((Date.now() - t0) / 1000); results.push(r); log(r.ok ? 'PASS' : 'FAIL', name, r.error || '', r.seconds + 's');
}

// ---- 1. the prologue from the title screen, real keys, English (and Chinese) -----------------------------------------
async function prologue(r, lang) {
  const { page, ctx, errors } = await open(lang === 'zh' ? '?lang=zh' : '', lang); const P = lang === 'zh' ? 'zh-' : '';
  await startNew(page); let s = await snap(page);
  if (s.beat !== 'P.kitchen') { throw new Error('a new game starts at ' + s.beat); }
  await wait(page, 3400); r.shots.push(await shot(page, P + 'p01-kitchen-arrive'));
  // she speaks first; then walk to her and talk
  await walkVia(page, [[-1.6, -1.3]], promptIs('mother')); s = await walkUntil(page, 1.5, -1.0, promptIs('mother'), 30000); r.shots.push(await shot(page, P + 'p02-kitchen-prompt'));
  await page.keyboard.press('KeyE'); await wait(page, 400);
  let shotN = 0;
  await talk(page, { pk1: 1, pk2: 0 }, async (q) => {
    const k = q.dialog && Array.isArray(q.dialog.line) ? q.dialog.line[1] : null;
    if ((k === 'p.k.m3' || k === 'p.k.b2' || k === 'p.k.e6' || k === 'p.k.kettleSfx') && shotN < 6) { shotN += 1; await wait(page, 250); r.shots.push(await shot(page, P + 'p03-argument-' + k.replace(/\./g, '_'))); }
    if (q.dialog && !Array.isArray(q.dialog.line) && shotN < 7) { shotN += 1; r.shots.push(await shot(page, P + 'p04-choice-' + q.dialog.line.choice)); }
  });
  s = await snap(page); if (!s.flags.kArgued) { throw new Error('the argument did not finish'); }
  // the front door; the last words
  await walkVia(page, [[1.2, -1.3], [-1.6, -1.3]], promptIs('frontdoor')); s = await walkUntil(page, -2.6, 1.6, promptIs('frontdoor'), 30000);
  await page.keyboard.press('KeyE'); await wait(page, 500);
  await talk(page, { pk3: 0 }, async (q) => { const k = q.dialog && Array.isArray(q.dialog.line) ? q.dialog.line[1] : null; if (k === 'p.k.careful') { await wait(page, 300); r.shots.push(await shot(page, P + 'p05-take-care')); } });
  await wait(page, 700); r.shots.push(await shot(page, P + 'p06-last-time-card'));
  s = await until(page, (q) => q.beat === 'P.house', 15000); await wait(page, 1200); r.shots.push(await shot(page, P + 'p07-house-card'));
  await wait(page, 3500); r.shots.push(await shot(page, P + 'p08-house'));
  await walkVia(page, [[-1.8, 0.2]], promptIs('machine')); s = await walkUntil(page, -1.7, -1.75, promptIs('machine'), 30000); await page.keyboard.press('KeyE'); await wait(page, 400);
  await talk(page, {}, async (q) => { const k = q.dialog && Array.isArray(q.dialog.line) ? q.dialog.line[1] : null; if (k === 'p.h.m3') { r.shots.push(await shot(page, P + 'p09-machine-mom')); } });
  await walkVia(page, [[-1.3, 1.95], [0.9, 1.95]], promptIs('keys')); s = await walkUntil(page, 1.1, 1.3, promptIs('keys'), 30000); await page.keyboard.press('KeyE'); await wait(page, 300);
  await walkVia(page, [[-0.6, 1.95], [1.4, 1.95]], promptIs('studydoor')); s = await walkUntil(page, 2.6, 2.1, promptIs('studydoor'), 30000); await page.keyboard.press('KeyE'); await wait(page, 300); await talk(page);
  s = await until(page, (q) => q.beat === '1.study', 15000); await wait(page, 1800); r.shots.push(await shot(page, P + 'p10-study'));
  // the KEEP box, the folded photo, the computer
  s = await walkUntil(page, -1.1, 2.2, promptIs('keepbox'), 40000); await page.keyboard.press('KeyE'); await wait(page, 400);
  await talk(page, {}, async (q) => { const k = q.dialog && Array.isArray(q.dialog.line) ? q.dialog.line[1] : null; if (k === 'c1.mara.unfold') { r.shots.push(await shot(page, P + 'p11-folded-photo')); } });
  s = await walkUntil(page, 3.0, -1.7, promptIs('computer'), 40000); await page.keyboard.press('KeyE'); await wait(page, 400); await talk(page);
  s = await until(page, (q) => q.beat === 'P.restore' && q.mode === 'play' && q.prompt, 30000); await wait(page, 600); r.shots.push(await shot(page, P + 'p12-restore-disk'));
  await holdE(page, (q) => q.crt && q.crt.stage === 'list'); await wait(page, 300); r.shots.push(await shot(page, P + 'p13-restore-list'));
  // a person reads the list: E opens the first record; the selection moves to the next one by itself
  await page.keyboard.press('KeyE'); await wait(page, 400); await talk(page);
  s = await until(page, (q) => q.prompt && q.crt.sel === 1, 6000);
  await page.keyboard.press('KeyE'); await wait(page, 400); s = await snap(page); if (s.crt.stage !== 'repair') { throw new Error('the damaged record did not ask for repair'); }
  r.shots.push(await shot(page, P + 'p14-restore-damaged'));
  await page.keyboard.down('KeyE'); await wait(page, 1500); r.shots.push(await shot(page, P + 'p15-restore-repairing')); await until(page, (q) => q.dialog || q.flags.repaired, 8000); await page.keyboard.up('KeyE');
  await talk(page);
  // down to the removed record (S), open it, then up (W) to the 2004 build
  await until(page, (q) => q.prompt && !q.dialog, 5000); await page.keyboard.press('KeyS'); await wait(page, 250); s = await snap(page); r.notes.push('after S the selection is ' + s.crt.sel);
  await page.keyboard.press('KeyE'); await wait(page, 400); await talk(page);
  s = await until(page, (q) => q.prompt && !q.dialog, 5000); r.notes.push('selection after the removed record: ' + s.crt.sel);
  if (s.crt.sel !== 2) { await page.keyboard.press('KeyW'); await wait(page, 250); }
  await page.keyboard.press('KeyE'); await wait(page, 400);
  await talk(page, {}, async (q) => { const k = q.dialog && Array.isArray(q.dialog.line) ? q.dialog.line[1] : null; if (k === 'p.r.b04.mara') { r.shots.push(await shot(page, P + 'p16-restore-compare')); } if (k === 'p.r.q2') { r.shots.push(await shot(page, P + 'p17-restore-question')); } });
  s = await until(page, (q) => q.crt && q.crt.stage === 'run' && q.prompt && q.prompt.id === 'run', 8000); r.shots.push(await shot(page, P + 'p18-restore-run'));
  await holdE(page, (q) => q.beat === 'P.summer');
  await wait(page, 1500); r.shots.push(await shot(page, P + 'p19-summer-card')); await wait(page, 2500); r.shots.push(await shot(page, P + 'p20-summer'));
  s = await walkUntil(page, 0.3, 23.8, promptIs('june'), 30000); await page.keyboard.press('KeyE'); await wait(page, 400);
  await talk(page, { ps: 1 }, async (q) => { const k = q.dialog && Array.isArray(q.dialog.line) ? q.dialog.line[1] : null; if (k === 'c1.june.oneFace' || k === 'p.s.j2') { await wait(page, 200); r.shots.push(await shot(page, P + 'p21-photo-' + k.replace(/\./g, '_'))); } });
  // follow her back along the pier until the record breaks
  s = await walkUntil(page, 0.1, 22.0, (q) => q.dialog && q.dialog.id === 'p.s.break', 30000); await wait(page, 500); r.shots.push(await shot(page, P + 'p22-record-breaks'));
  await talk(page); s = await until(page, (q) => q.beat === '1.town', 15000); await wait(page, 1500); r.shots.push(await shot(page, P + 'p23-town-2004'));
  r.notes.push('choices: ' + JSON.stringify(s.choices)); r.notes.push('journal: ' + JSON.stringify(await page.evaluate(() => window.V5Debug.journal())));
  // the save survives a reload, and Continue brings the player back to the same beat
  await wait(page, 5500); await page.reload(); await page.getByTestId('continue').waitFor({ timeout: 30000 }); await page.keyboard.press('Enter'); s = await until(page, (q) => q.beat, 20000);
  if (s.beat !== '1.town') { throw new Error('Continue loaded ' + s.beat); }
  r.notes.push('page errors: ' + errors.length); if (errors.length) { throw new Error('page errors: ' + errors.slice(0, 3).join(' | ')); }
  await ctx.close();
}
if (want('prologue')) { await record('prologue in English with real keys (kitchen → house → study → restore → 1998 → town), then Continue after a reload', (r) => prologue(r, 'en')); }
if (want('prologue-zh')) { await record('prologue in Chinese with real keys', (r) => prologue(r, 'zh')); }

// ---- 2. the chase: catching June's hand stops Elena (RC3: she kept running on the spot) ------------------------------------
if (want('chase')) {
  await record('chase: after the grab Elena stands still through the whole conversation', async (r) => {
    const { page, ctx } = await open('?preview=1.chase');
    await until(page, (s) => s.beat === '1.chase', 60000); await wait(page, 600);
    await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
    let s; const t0 = Date.now();
    for (;;) { s = await snap(page); if (s.prompt && s.prompt.id === 'hand') { break; } if (Date.now() - t0 > 60000) { throw new Error('no hand prompt'); } if (s.y < 0.05 && s.x > 2.6 && s.x < 4.0) { await page.keyboard.press('Space'); } if (s.x > 5 && s.train) { await page.keyboard.down('KeyD'); await wait(page, 90); await page.keyboard.up('KeyD'); } await wait(page, 60); }   // the luggage cart: jump it; then to the train's open door (on her right)
    for (let i = 0; i < 30; i++) { await page.keyboard.press('KeyE'); await wait(page, 60); const q = await snap(page); if (q.dialog) { break; } if (!q.prompt) { await page.keyboard.down('KeyD'); await wait(page, 60); await page.keyboard.up('KeyD'); } }
    await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft'); await wait(page, 300);
    const a = await page.evaluate(() => { const s = window.V5Debug.snapshot(); return { x: s.x, z: s.z, dialog: s.dialog && s.dialog.id }; });
    const sp = await page.evaluate(() => (window.V5Debug.bodySpeed ? window.V5Debug.bodySpeed() : -1));
    await wait(page, 1500); r.shots.push(await shot(page, 'c1-hand-dialogue'));
    const b = await snap(page);
    r.notes.push(`during ${a.dialog}: moved ${Math.hypot(b.x - a.x, b.z - a.z).toFixed(3)} m in 1.5 s; body speed that drives the run animation: ${sp.toFixed(2)} m/s`);
    if (sp > 0.05) { throw new Error('the body still has speed ' + sp.toFixed(2) + ' m/s, so the run animation plays'); }
    if (!a.dialog || a.dialog !== 'c1.hand') { throw new Error('no hand dialogue: ' + a.dialog); }
    if (Math.hypot(b.x - a.x, b.z - a.z) > 0.01) { throw new Error('Elena moved during the conversation'); }
    await ctx.close();
  });
}

// ---- 3. cameras: no dialogue close-up has a coat or hair in front of the speaker's face, or sits on another body -------------------------
// (the first version of this check only measured the distance to bodies; it passed with the bug in. The scan casts a ray
// from the camera to the speaker's head and reports what is in the way: tools/r4-camera-scan.mjs)
if (want('train') || want('cameras')) {
  await record('cameras: every dialogue close-up in every beat is clear of coats, hair and other bodies', async (r) => {
    const out = await new Promise((res) => { const c = spawn('node', ['tools/r4-camera-scan.mjs'], { env: Object.assign({}, process.env, { R4_CAM_OUT: path.join(OUT, 'cameras') }) }); let t = ''; c.stdout.on('data', (d) => { t += d; }); c.stderr.on('data', (d) => { t += d; }); c.on('close', (code) => res({ code, t })); });
    r.notes.push(out.t.trim().split('\n').slice(-6).join(' | ')); if (out.code !== 0) { throw new Error(out.t.trim().split('\n').slice(-5).join(' | ')); }
  });
}

// ---- 4. the beam: a player who follows the on-screen line with A/D finds June and then the cottage -----------------------------
async function beamPlayer(page, r, prefix, doneFn) {
  const t0 = Date.now(); let lastText = ''; let n = 0;
  for (;;) {
    const s = await snap(page); if (doneFn(s)) { return Date.now() - t0; }
    if (Date.now() - t0 > 120000) { throw new Error('beam not done in 2 min: ' + JSON.stringify(s.beam)); }
    if (s.dialog || s.choice) { await talk(page); continue; }
    const text = await page.evaluate(() => (document.querySelector('.act') || {}).textContent || '');
    if (text !== lastText && n < 6) { n += 1; lastText = text; r.notes.push('screen says: ' + text); r.shots.push(await shot(page, prefix + n)); }
    // the line names the key to hold; "almost" means tap it; "hold the light there" means let go
    const m = /hold ([A-Z])\b|按住 ([A-Z])\b/.exec(text); const near = /tap ([A-Z])\b|轻点 ([A-Z])\b/.exec(text);
    if (m) { const k = 'Key' + (m[1] || m[2]); await page.keyboard.down(k); await wait(page, 180); await page.keyboard.up(k); }
    else if (near) { const k = 'Key' + (near[1] || near[2]); await page.keyboard.down(k); await wait(page, 70); await page.keyboard.up(k); await wait(page, 120); }
    else { await wait(page, 150); }
  }
}
if (want('beam')) {
  await record('beam (ch. 3): following the on-screen line with A/D finds June, then the cottage', async (r) => {
    const { page, ctx } = await open('?preview=3.beam');
    await until(page, (s) => s.beat === '3.beam', 60000);
    await wait(page, 1200); r.shots.push(await shot(page, 'c3-beam-0-wait'));
    const ms1 = await beamPlayer(page, r, 'c3-beam-june-', (s) => !!s.flags.foundJune);
    r.notes.push(`June found after ${(ms1 / 1000).toFixed(1)} s (including her run to the rocks)`);
    const ms2 = await beamPlayer(page, r, 'c3-beam-cottage-', (s) => !!s.flags.beamDone || s.beat === '3.cliff');
    r.notes.push(`cottage found after ${(ms2 / 1000).toFixed(1)} s more`);
    await ctx.close();
  });
}
if (want('town-beam')) {
  await record('beam (ch. 7): the last light onto the old pier with A/D', async (r) => {
    // a save from just after the seasons are made (the snow save, before the beam and the new planks), loaded with Continue
    const all = JSON.parse(fs.readFileSync('frontend/v5/data/preview-saves.json', 'utf8')).saves; const sv = JSON.parse(JSON.stringify(all.snow));
    sv.flags.beamPier = false; delete sv.edition.pier_walk; sv.pos = {};
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); await ctx.addInitScript((v) => { if (!sessionStorage.getItem('r4set')) { localStorage.setItem('v5.save.v1', v); sessionStorage.setItem('r4set', '1'); } }, JSON.stringify(sv));
    const page = await ctx.newPage(); await page.goto(`http://127.0.0.1:${PORT}/v5/`); await page.getByTestId('continue').waitFor({ timeout: 60000 }); await page.keyboard.press('Enter');
    await until(page, (s) => s.beat === '7.town' && s.beam && s.beam.ready, 60000); await talk(page);
    const ms = await beamPlayer(page, r, 'c7-beam-', (s) => !!s.flags.beamPier);
    r.notes.push(`pier found after ${(ms / 1000).toFixed(1)} s`); await ctx.close();
  });
}

// ---- 5. the chain (RC3 fix, re-checked) ---------------------------------------------------------------------------------------
if (want('chain')) {
  await record('ride (ch. 3): the chain prompt is on screen and holding E fixes it', async (r) => {
    const { page, ctx } = await open('?preview=3.ride');
    await until(page, (s) => s.beat === '3.ride', 60000); await page.keyboard.down('KeyW'); const t0 = Date.now();
    for (;;) { const s = await snap(page); if (s.ride && s.ride.stop === 'chain') { break; } if (s.dialog) { await page.keyboard.press('Space'); } if (Date.now() - t0 > 240000) { throw new Error('never reached the chain'); } await wait(page, 200); }
    await page.keyboard.up('KeyW'); await talk(page); await until(page, (s) => s.prompt && s.prompt.id === 'chain', 8000); r.shots.push(await shot(page, 'c3-chain-prompt'));
    await holdE(page, (s) => !(s.ride && s.ride.stop === 'chain'), 12000); await talk(page); r.notes.push('chain fixed with E'); await ctx.close();
  });
}

// ---- 6. the epilogue: unfold, the letter, goodbye, the credits ---------------------------------------------------------------------
if (want('epilogue')) {
  await record('epilogue: unfold the photo, read the letter to M., switch off the screen, credits', async (r) => {
    const { page, ctx, errors } = await open('?preview=E.study');
    await until(page, (s) => s.beat === 'E.study', 60000); await wait(page, 2500); r.shots.push(await shot(page, 'e01-study-evening'));
    await walkUntil(page, 3.8, -1.5, promptIs('unfold'), 30000); r.shots.push(await shot(page, 'e02-unfold-prompt'));
    await holdE(page, (s) => !!s.flags.unfolded || !!s.dialog, 10000); await wait(page, 1300); r.shots.push(await shot(page, 'e03-photo-unfolded'));
    await talk(page);
    await walkUntil(page, -1.1, 2.2, promptIs('keepbox'), 30000); await page.keyboard.press('KeyE'); await wait(page, 400);
    await talk(page, {}, async (q) => { const k = q.dialog && Array.isArray(q.dialog.line) ? q.dialog.line[1] : null; if (k === 'p.e.l3') { r.shots.push(await shot(page, 'e04-letter')); } });
    await walkUntil(page, 3.0, -1.7, promptIs('computer'), 30000); await page.keyboard.press('KeyE'); await wait(page, 400);
    await talk(page, {}, async (q) => { const k = q.dialog && Array.isArray(q.dialog.line) ? q.dialog.line[1] : null; if (k === 'p.e.f4') { r.shots.push(await shot(page, 'e05-final-line')); } });
    await page.getByTestId('credits').waitFor({ timeout: 15000 }); await wait(page, 800); r.shots.push(await shot(page, 'e06-credits'));
    if (errors.length) { throw new Error('page errors: ' + errors.slice(0, 3).join(' | ')); }
    await ctx.close();
  });
}

await browser.close(); srv.kill();
const sum = { when: new Date().toISOString(), chromium: browser.version ? browser.version() : null, port: PORT, passed: results.filter((x) => x.ok).length, failed: results.filter((x) => !x.ok).length, results };
fs.writeFileSync(path.join(OUT, only.length ? `results-${only.join('-')}.json` : 'results.json'), JSON.stringify(sum, null, 2));
log(`${sum.passed} passed, ${sum.failed} failed`);
process.exit(sum.failed ? 1 : 0);
