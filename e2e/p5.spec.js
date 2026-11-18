// P5 browser acceptance in real Chromium (WebGL through SwiftShader in CI).
//
// A scripted player uses only ordinary input: held keys, mouse drags and clicks, touch pointer events. It reads the
// read-only window.P5Debug.snapshot() to know where it stands, like a person looking at the screen; it never changes
// game state. Paths are planned with the game's own levels.js on the floor the snapshot reports.
// Times printed as P5_TIME are automated, not human play time. Screenshots go out as P5_SHOT lines and a timestamped
// operation record as P5_REC lines (CI only), so they can be recovered from the job log.

const { test, expect, devices } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] }, video: { mode: 'on', size: { width: 1280, height: 720 } } });

const PATH = '/p5/';
const mod = {};
async function lib(name) { if (!mod[name]) { mod[name] = await import(pathToFileURL(path.join(__dirname, '..', 'frontend', 'p5', 'js', name + '.js')).href); } return mod[name]; }
const BRIDGE_FROM = { messageId: '<junebug.19980814.2@inkwell.example>', source: 'disk', crc: '118ca1f9' };

// ---- evidence -------------------------------------------------------------------------------------------
async function shot(page, testInfo, name) {
  const buf = await page.screenshot({ type: 'jpeg', quality: 72 });
  await testInfo.attach(name, { body: buf, contentType: 'image/jpeg' });
  if (process.env.CI) { console.log(`P5_SHOT ${name} ${buf.toString('base64')}`); }
}
function recorder(page, testInfo, label, t0ref) {
  let n = 0;
  return async (action) => {
    const s = await snap(page);
    const secs = ((Date.now() - t0ref.t) / 1000).toFixed(1);
    const line = `${secs}s | ${s.scene} | ${s.step} | build ${s.build} | ${s.fps} fps | ${action}`;
    testInfo.annotations.push({ type: 'record', description: line });
    if (process.env.CI) { const buf = await page.screenshot({ type: 'jpeg', quality: 40 }); console.log(`P5_REC ${label} ${String(n).padStart(3, '0')} ${encodeURIComponent(line)} ${buf.toString('base64')}`); } else { console.log('REC', label, line); }
    n += 1;
  };
}

// ---- driving the game -----------------------------------------------------------------------------------
const snap = (page) => page.evaluate(() => window.P5Debug.snapshot());
const until = (page, fn, arg, timeout) => page.waitForFunction(fn, arg, { polling: 100, timeout: timeout || 30000 });
const tr = (page, lang, key, vars) => page.evaluate(async ([l, k, v]) => (await import('/p5/js/i18n.js')).t(l, k, v), [lang, key, vars || null]);
function keyDriver(page) {
  const held = new Set();
  return {
    async set(keys) { for (const k of [...held]) { if (!keys.has(k)) { await page.keyboard.up(k); held.delete(k); } } for (const k of keys) { if (!held.has(k)) { await page.keyboard.down(k); held.add(k); } } },
    async release() { await this.set(new Set()); }
  };
}
function stickDriver(page) {
  let down = false, box = null;
  return {
    async set(fx, fz) {
      if (!box) { box = await page.getByTestId('stick').boundingBox(); }
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2, x = cx + fx * box.width * 0.4, y = cy - fz * box.height * 0.4;
      if (!fx && !fz) { if (down) { await page.getByTestId('stick').dispatchEvent('pointerup', { pointerId: 7, clientX: cx, clientY: cy, pointerType: 'touch' }); down = false; } return; }
      if (!down) { await page.getByTestId('stick').dispatchEvent('pointerdown', { pointerId: 7, clientX: x, clientY: y, pointerType: 'touch', isPrimary: true }); down = true; } else { await page.getByTestId('stick').dispatchEvent('pointermove', { pointerId: 7, clientX: x, clientY: y, pointerType: 'touch' }); }
    },
    async release() { await this.set(0, 0); }
  };
}
async function stopAll(ctl) { if (ctl.kind === 'touch') { await ctl.stick.release(); } else { await ctl.keys.release(); } }
// Steers toward (x, z) relative to the camera, like a player with W A S D or the stick.
async function walkTo(page, ctl, x, z, tol, stopIf) {
  const tolerance = tol || 0.3; let lastProgress = Date.now(), best = Infinity;
  for (;;) {
    const s = await snap(page);
    const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz);
    if (d < tolerance || (stopIf && stopIf(s))) { break; }
    if (d < best - 0.05) { best = d; lastProgress = Date.now(); }
    if (Date.now() - lastProgress > 9000) { await stopAll(ctl); throw new Error(`stuck walking to ${x},${z}: ${JSON.stringify({ x: s.x, z: s.z, scene: s.scene, busy: s.busy, mode: s.mode, dialog: s.dialog })}`); }
    if (s.busy || s.dialog || s.mode !== 'play') { await stopAll(ctl); await page.waitForTimeout(150); continue; }
    const fwdX = -Math.sin(s.yaw), fwdZ = -Math.cos(s.yaw), rgtX = Math.cos(s.yaw), rgtZ = -Math.sin(s.yaw);
    let fz = (dx * fwdX + dz * fwdZ) / d, fx = (dx * rgtX + dz * rgtZ) / d;
    if (ctl.kind === 'touch') { await ctl.stick.set(fx, fz); } else {
      const keys = new Set();
      if (Date.now() - lastProgress > 2000) { if (Math.floor((Date.now() - lastProgress) / 1000) % 2 === 0) { keys.add(fz >= 0 ? 'w' : 's'); } else { keys.add(fx >= 0 ? 'd' : 'a'); } } else {
        if (fz > 0.38) { keys.add('w'); } if (fz < -0.38) { keys.add('s'); } if (fx > 0.38) { keys.add('d'); } if (fx < -0.38) { keys.add('a'); }
      }
      await ctl.keys.set(keys);
    }
    await page.waitForTimeout(45);
  }
  await stopAll(ctl);
}
// Walk to an interaction point along a path the game's own planner finds on the current floor.
async function follow(page, ctl, id, opts) {
  const Lv = await lib('levels');
  const s = await snap(page);
  const p = id === 'theo' && s.theo ? { x: s.theo.x, z: s.theo.z, r: 1.8 } : Lv.point(s.scene, id);
  const ctx = { assets: new Set(s.assets), bridgeLen: s.bridgeLen };
  const route = Lv.findPath(s.scene, { x: s.x, z: s.z }, p, ctx, { reach: (opts && opts.reach) || Math.max(0.6, (p.r || 1.5) - 0.35) });
  if (!route) { throw new Error(`no path to ${id} from ${s.x},${s.z}`); }
  const want = (opts && opts.stopNear) || id;
  for (const [x, z] of route.slice(1)) { await walkTo(page, ctl, x, z, 0.32, (q) => q.near === want); if ((await snap(page)).near === want) { break; } }
  // like a player who sees no prompt yet: step toward the thing until its prompt appears
  if ((await snap(page)).near !== want) { await walkTo(page, ctl, p.x, p.z, 0.5, (q) => q.near === want); }
}
async function press(page, ctl) { if (ctl.kind === 'touch') { await page.getByTestId('use').dispatchEvent('pointerdown', { pointerType: 'touch' }); await page.getByTestId('use').dispatchEvent('pointerup', { pointerType: 'touch' }); } else { await page.keyboard.press('e'); } }
async function useNear(page, ctl, id) {
  await until(page, (want) => { const s = window.P5Debug.snapshot(); return s.near === want && !s.busy && !s.dialog && s.mode === 'play'; }, id, 15000);
  await press(page, ctl); await page.waitForTimeout(250);
}
// Reads every dialogue line with E (or the hand), waits for cuts and scene changes to finish.
async function settle(page, ctl, onLine) {
  const seen = [];
  for (let i = 0; i < 300; i++) {
    const s = await snap(page);
    if (s.dialog) {
      const k = s.dialog.key + s.dialog.i; if (seen.indexOf(k) < 0) { seen.push(k); if (onLine) { await onLine(s.dialog, s); } }
      await page.waitForTimeout(300); await press(page, ctl); await page.waitForTimeout(120); continue;
    }
    if (s.mode === 'reader') { return seen; }
    if (!s.busy && (s.mode === 'play' || s.mode === 'ending')) { await page.waitForTimeout(250); const s2 = await snap(page); if (!s2.busy && !s2.dialog) { return seen; } }
    await page.waitForTimeout(200);
  }
  throw new Error('never settled: ' + JSON.stringify(await snap(page)));
}
async function objectiveIs(page, lang, step) { await expect(page.getByTestId('objective')).toHaveText(await tr(page, lang, 'obj.' + step), { timeout: 15000 }); }
async function seedSave(page, state, extra) {
  await page.goto(PATH); await page.waitForFunction(() => window.P5Debug);
  await page.evaluate(([s, x]) => { localStorage.setItem('p5.save.v1', JSON.stringify(s)); Object.entries(x || {}).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v))); }, [state, extra || null]);
  await page.reload(); await page.waitForFunction(() => window.P5Debug && document.querySelector('[data-testid="continue"]'));
}
function townState(over) {
  const flags = { computer: true, deduced: true, opened: true, arrived: true, theoMet: false, gapSeen: false, readerSeen: false, theoCrossed: false, theoTalked: false, switchUnlocked: false, switched: false, pierReached: false, anomaly: false, ended: false, lamp: true };
  const o = over || {};
  return Object.assign({ v: 1, scene: 'town', build: '2004', disk: false, bridge: 0, bridgeFrom: null, clues: ['photo', 'keepbox'], seen: [], pos: {}, hint: { step: 'B1', level: 0 }, guide: false, theoLine: 0 }, o, { flags: Object.assign(flags, o.flags || {}) });
}
const DONE_BRIDGE = { bridge: 1, bridgeFrom: BRIDGE_FROM, disk: true, flags: { theoMet: true, gapSeen: true, readerSeen: true, theoCrossed: true } };
function watch(page, issues) {
  page.on('pageerror', (e) => issues.push('page error: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) { issues.push('console: ' + m.text()); } });
}
// The trail must stay on the floor the player can walk on right now.
async function checkTrail(page) {
  const Lv = await lib('levels'); const s = await snap(page);
  expect(s.guideVisible, 'trail visible').toBe(true);
  expect(s.guidePath && s.guidePath.length >= 2, 'trail has a path').toBe(true);
  const ctx = { assets: new Set(s.assets), bridgeLen: s.bridgeLen };
  for (let i = 1; i < s.guidePath.length; i++) { const [a, b] = [s.guidePath[i - 1], s.guidePath[i]]; expect(Lv.clearLine(s.scene, a[0], a[1], b[0], b[1], ctx, null, Lv.PLAYER_RADIUS - 0.04), `trail segment ${i} on walkable floor`).toBe(true); }
  return s;
}

// ---- the full English playthrough ------------------------------------------------------------------------
test.describe('P5 full playthrough', () => {
  test.use({ viewport: { width: 1280, height: 720 } });
  test.setTimeout(1200000);

  test('English, keyboard and mouse: study, skylark, town, Theo, the bridge from the archive, builds, old pier, lighthouse', async ({ page }, testInfo) => {
    const issues = []; watch(page, issues);
    const ctl = { kind: 'keys', keys: keyDriver(page) };
    const t0 = { t: Date.now() }; const rec = recorder(page, testInfo, 'en', t0);
    const marks = {}; const mark = (k) => { marks[k] = (Date.now() - t0.t) / 1000; };
    await page.goto(PATH);
    await page.waitForFunction(() => window.P5Debug && window.P5Debug.snapshot().frames > 10);
    await expect(page.getByTestId('start')).toBeVisible({ timeout: 20000 });
    await shot(page, testInfo, '01-title'); await rec('title screen');

    // ---- prologue: the study
    t0.t = Date.now();
    await page.getByTestId('start').click();
    await expect(page.getByTestId('intro')).toBeVisible();
    await page.waitForTimeout(2600); await shot(page, testInfo, '02-intro'); await rec('intro: “Mom died in the spring.”');
    await until(page, () => window.P5Debug.snapshot().mode === 'play', null, 20000);
    await objectiveIs(page, 'en', 'A1'); mark('objective-visible');
    // the HUD is text over the world: no panel behind it
    const hudStyle = await page.evaluate(() => { const h = document.querySelector('[data-testid="hud"]'), o = document.querySelector('[data-testid="objective"]'); const a = getComputedStyle(h), b = getComputedStyle(o); return { hudBg: a.backgroundColor, objBg: b.backgroundColor, objBorder: b.borderTopWidth, hudShadow: a.boxShadow, chapter: document.querySelector('[data-testid="chapter"]').textContent, hint: document.querySelector('[data-testid="hint"]').textContent }; });
    expect(hudStyle.hudBg).toBe('rgba(0, 0, 0, 0)'); expect(hudStyle.objBg).toBe('rgba(0, 0, 0, 0)'); expect(hudStyle.objBorder).toBe('0px'); expect(hudStyle.hudShadow).toBe('none');
    expect(hudStyle.chapter).toBe(await tr(page, 'en', 'chap.study')); expect(hudStyle.hint).toBe(await tr(page, 'en', 'hint.A1.0'));
    await shot(page, testInfo, '03-study-hud'); await rec('chapter, objective and one light hint; nothing else');
    await walkTo(page, ctl, 0.6, -0.6, 0.3);
    const box = await page.getByTestId('canvas').boundingBox();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5); await page.mouse.down();
    for (let i = 0; i < 14; i++) { await page.mouse.move(box.x + box.width * 0.6 - i * 14, box.y + box.height * 0.5 + i * 1.5); await page.waitForTimeout(30); }
    for (let i = 14; i > 0; i--) { await page.mouse.move(box.x + box.width * 0.6 - i * 14, box.y + box.height * 0.5); await page.waitForTimeout(30); }
    await page.mouse.up();
    expect((await snap(page)).tutorial).toBeGreaterThanOrEqual(2);
    // light the way: click the goal
    await page.getByTestId('objective').click();
    await until(page, () => window.P5Debug.snapshot().guideVisible, null, 10000);
    await checkTrail(page);
    await shot(page, testInfo, '04-study-trail'); await rec('clicked the goal: a few warm motes lead toward the desk');
    await follow(page, ctl, 'computer');
    await expect(page.getByTestId('prompt')).toContainText('E');
    await shot(page, testInfo, '05-study-prompt'); await rec('first prompt, fully explained: [E] Use · Mom’s old computer');
    await useNear(page, ctl, 'computer');
    await settle(page, ctl, async (d) => { if (d.key === 'mara.who') { await shot(page, testInfo, '06-study-skylark'); await rec('the newsreader is logged in as skylark. “Who’s skylark?”'); } });
    await objectiveIs(page, 'en', 'A2'); mark('first-discovery');
    expect((await snap(page)).hudHidden).toBe(false);
    await follow(page, ctl, 'photo'); await useNear(page, ctl, 'photo');
    await settle(page, ctl, async (d) => { if (d.key === 'say.photo') { expect((await snap(page)).hudHidden).toBe(true); await shot(page, testInfo, '07-study-photo'); await rec('photo: “sky & june — we’re going to finish it.” (HUD faded)'); } });
    await follow(page, ctl, 'keepbox'); await useNear(page, ctl, 'keepbox');
    await settle(page, ctl, async (d) => { if (d.key === 'mara.deduce1') { await shot(page, testInfo, '08-study-deduce'); await rec('two clues: “Sky. skylark. That was Mom.”'); } });
    await objectiveIs(page, 'en', 'A3'); mark('identity');
    await follow(page, ctl, 'computer'); await useNear(page, ctl, 'computer');
    await settle(page, ctl);

    // ---- the town (2004 public build)
    await until(page, () => window.P5Debug.snapshot().scene === 'town', null, 30000);
    await settle(page, ctl);
    await objectiveIs(page, 'en', 'B1'); mark('town');
    let s = await snap(page); expect(s.build).toBe('2004'); expect(s.facts.bridgeOk).toBe(false);
    await page.waitForTimeout(500);
    await shot(page, testInfo, '09-town-arrival'); await rec('Last Light, rebuilt from the posts online. Someone is shouting.');
    await checkTrail(page);
    await follow(page, ctl, 'gap', { stopNear: 'theo' });
    await until(page, () => window.P5Debug.snapshot().near === 'theo', null, 15000);
    await shot(page, testInfo, '10-town-theo-across'); await rec('Theo, stuck on the far side of the canal');
    await useNear(page, ctl, 'theo');
    await settle(page, ctl, async (d) => { if (d.key === 'theo.dontAsk') { await shot(page, testInfo, '11-town-theo-talk'); await rec('“That’s an excellent question. Please don’t ask it again.”'); } });
    await objectiveIs(page, 'en', 'B2');
    await follow(page, ctl, 'gap'); await useNear(page, ctl, 'gap');
    await settle(page, ctl);
    await until(page, () => window.P5Debug.snapshot().mode === 'reader', null, 15000);
    await objectiveIs(page, 'en', 'B3');
    await expect(page.getByTestId('copy-mirror')).toHaveAttribute('data-status', 'truncated');
    await expect(page.getByTestId('copy-groups')).toHaveAttribute('data-status', 'stripped');
    await expect(page.getByTestId('bridge-result')).toHaveAttribute('data-status', 'damaged');
    await expect(page.getByTestId('panel')).not.toContainText('Message-ID');            // technical fields hidden by default
    await shot(page, testInfo, '12-reader-damaged'); await rec('archive: the mirror copy is cut off, the groups archive dropped the file');
    await page.getByTestId('tech').click();
    await expect(page.getByTestId('panel')).toContainText('Message-ID: <junebug.19980814.2@inkwell.example>');
    await expect(page.getByTestId('panel')).toContainText('crc32 118ca1f9');
    await shot(page, testInfo, '13-reader-tech'); await rec('technical details on request: Message-ID, Path, size, CRC-32');
    await page.getByTestId('toggle-disk').click();
    await expect(page.getByTestId('bridge-result')).toHaveAttribute('data-status', 'ok');
    await expect(page.getByTestId('copy-disk')).toHaveAttribute('data-status', 'ok');
    await objectiveIs(page, 'en', 'B4');
    await shot(page, testInfo, '14-reader-disk'); await rec('added Mom’s backup disk: a complete copy, CRC matches');
    // take the disk out again: the restore is impossible; put it back
    await page.getByTestId('toggle-disk').click();
    await expect(page.getByTestId('bridge-result')).toHaveAttribute('data-status', 'damaged'); await objectiveIs(page, 'en', 'B3');
    await page.getByTestId('toggle-disk').click();
    await expect(page.getByTestId('bridge-result')).toHaveAttribute('data-status', 'ok'); await objectiveIs(page, 'en', 'B4');
    await page.getByTestId('tech').click();
    await page.getByTestId('reader-close').click();
    await until(page, () => window.P5Debug.snapshot().mode === 'play', null, 10000);
    // hold E: June's planks go in one by one
    await until(page, () => { const q = window.P5Debug.snapshot(); return q.near === 'gap' && q.nearHold; }, null, 15000);
    await expect(page.getByTestId('prompt')).toContainText('Hold');
    await shot(page, testInfo, '15-town-hold-prompt'); await rec('the first repair teaches one action: Hold E');
    await page.keyboard.down('e');
    await until(page, () => window.P5Debug.snapshot().bridge >= 0.45, null, 30000);
    await page.keyboard.up('e');
    s = await snap(page); expect(s.bridge).toBeGreaterThan(0.4); expect(s.bridge).toBeLessThan(1);
    expect(s.bridgeLen).toBeGreaterThan(1); expect(s.bridgeLen).toBeLessThan(2.4);
    await shot(page, testInfo, '16-town-bridge-half'); await rec('let go halfway: the planks stay, the rest waits');
    await page.keyboard.down('e');
    await until(page, () => window.P5Debug.snapshot().bridge >= 1, null, 30000);
    await page.keyboard.up('e');
    mark('bridge');
    await page.waitForTimeout(600);
    await shot(page, testInfo, '17-town-bridge-done'); await rec('the bridge is whole; Theo starts across');
    await settle(page, ctl);
    s = await snap(page); expect(Math.abs(s.bridgeLen - 3.2)).toBeLessThan(0.01); expect(s.bridgeFrom.source).toBe('disk');
    await until(page, () => !window.P5Debug.snapshot().theo.walking, null, 20000);
    await objectiveIs(page, 'en', 'B5');
    await follow(page, ctl, 'theo'); await useNear(page, ctl, 'theo');
    await settle(page, ctl, async (d) => { if (d.key === 'theo.pier') { await shot(page, testInfo, '18-town-theo-pier'); await rec('Theo: in the summer build he walked out on the old pier'); } });
    await objectiveIs(page, 'en', 'C1');
    await until(page, () => !window.P5Debug.snapshot().theo.walking, null, 30000);   // let Theo off the bridge first
    await expect(page.getByTestId('build')).toBeVisible();
    await expect(page.getByTestId('tip')).toContainText('V');

    // ---- the old pier
    await follow(page, ctl, 'pierGate'); await useNear(page, ctl, 'pierGate'); await settle(page, ctl);
    await walkTo(page, ctl, 0, 20, 0.3, (q) => q.z > 14.7).catch(() => {});
    s = await snap(page); expect(s.z).toBeLessThan(14.7);                                    // closed in 2004
    await shot(page, testInfo, '19-town-pier-closed'); await rec('2004: PIER CLOSED, half the planks gone');
    await page.keyboard.press('v');
    await until(page, () => window.P5Debug.snapshot().build === '1998' && !window.P5Debug.snapshot().busy, null, 15000);
    await settle(page, ctl);
    s = await snap(page); expect(s.standable).toBe(true); expect(s.assets).toContain('pier_old');
    await expect(page.getByTestId('build')).toContainText('1998');
    await shot(page, testInfo, '20-town-1998'); await rec('V: the 1998 summer build. Flags, warm light, the pier is open');
    await walkTo(page, ctl, 0, 18.5, 0.3);
    await settle(page, ctl);
    expect((await snap(page)).flags.pierReached).toBe(true);
    await objectiveIs(page, 'en', 'C2');
    // switch while standing on the pier: the 2004 floor has no pier here, so Mara is moved to safe ground
    const before = await snap(page);
    await page.keyboard.press('v');
    await until(page, () => window.P5Debug.snapshot().build === '2004' && !window.P5Debug.snapshot().busy, null, 15000);
    s = await snap(page); expect(s.standable).toBe(true); expect(s.z).toBeLessThan(14.7); expect(s.safeCount).toBeGreaterThan(before.safeCount);
    await shot(page, testInfo, '21-town-switch-safe'); await rec('switched to 2004 on the pier: moved to the promenade, not into the sea');
    await page.keyboard.press('v');
    await until(page, () => window.P5Debug.snapshot().build === '1998' && !window.P5Debug.snapshot().busy, null, 15000);
    await page.getByTestId('objective').click().catch(() => {});
    if (!(await snap(page)).guide) { await page.getByTestId('objective').click(); }
    await page.waitForTimeout(800);
    await checkTrail(page);
    await walkTo(page, ctl, 0, 19, 0.3);
    await shot(page, testInfo, '22-town-pier-1998'); await rec('the old pier in the summer build');
    await walkTo(page, ctl, 0, 24.0, 0.3, (q) => q.mode === 'cut' || q.shot);
    await until(page, () => window.P5Debug.snapshot().shot, null, 15000);
    await page.waitForTimeout(2600);
    s = await snap(page); expect(s.hudHidden).toBe(true);
    await shot(page, testInfo, '23-town-anomaly'); await rec('a light flashes on the half-built lighthouse; this build has no lamp');
    mark('anomaly');
    await settle(page, ctl, async (d) => { if (d.key === 'mara.june2005') { await shot(page, testInfo, '24-town-june2005'); await rec('“The summer build was waiting for a lighthouse rule from June… posted in 2005.”'); } });
    await expect(page.getByTestId('ending')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('ending')).toContainText(await tr(page, 'en', 'ui.nextChapter'));
    mark('ending');
    await shot(page, testInfo, '25-ending'); await rec('Chapter 1 complete. Next: The Lighthouse That Never Lit');
    await page.getByTestId('keep-exploring').click();
    await objectiveIs(page, 'en', 'END');
    await page.keyboard.press('r');
    await until(page, () => window.P5Debug.snapshot().mode === 'reader', null, 10000);
    await page.getByTestId('tab-light').click();
    await expect(page.getByTestId('light-status')).toHaveAttribute('data-status', 'envelope');
    await shot(page, testInfo, '26-reader-light'); await rec('archive: the rule exists only as headers, from junebug, 2005');
    await page.keyboard.press('Escape');
    const heard = (await snap(page)).heard;
    // reload and continue in the same place
    const was = await snap(page);
    await page.reload(); await page.waitForFunction(() => window.P5Debug && document.querySelector('[data-testid="continue"]'));
    await page.getByTestId('continue').click();
    await until(page, () => window.P5Debug.snapshot().mode === 'play', null, 15000);
    s = await snap(page);
    expect(s.scene).toBe('town'); expect(s.step).toBe('END'); expect(s.build).toBe('1998'); expect(s.bridge).toBe(1);
    expect(Math.hypot(s.x - was.x, s.z - was.z)).toBeLessThan(1.0);
    await page.waitForTimeout(500);
    await shot(page, testInfo, '27-resumed'); await rec('reloaded and continued: same place, same build, bridge still there');

    console.log(`P5_TIME en total=${((Date.now() - t0.t) / 1000).toFixed(1)}s ` + Object.entries(marks).map(([k, v]) => `${k}=${v.toFixed(1)}s`).join(' ') + ` fps=${s.fps}  (automated, not human play time)`);
    expect(marks['objective-visible'], 'objective on screen within 30 s').toBeLessThan(30);
    expect(heard).toEqual(expect.arrayContaining(['step', 'inspect', 'objective', 'crtWake', 'modem', 'diskIn', 'diskOut', 'plank', 'bridgeDone', 'to98', 'to04', 'anomaly']));
    expect(issues, issues.join('\n')).toEqual([]);
  });
});

// ---- Chinese ---------------------------------------------------------------------------------------------
test.describe('P5 Chinese', () => {
  test.use({ viewport: { width: 1280, height: 720 } });
  test.setTimeout(600000);
  test('Simplified Chinese: title, study opening, then the bridge chapter in Chinese', async ({ page }, testInfo) => {
    const issues = []; watch(page, issues);
    const ctl = { kind: 'keys', keys: keyDriver(page) };
    await page.goto(PATH); await page.waitForFunction(() => window.P5Debug);
    await expect(page.getByTestId('start')).toBeVisible({ timeout: 20000 });
    await page.getByTestId('lang').click();
    await expect(page.getByTestId('start')).toHaveText('开始');
    await shot(page, testInfo, 'zh-01-title');
    await page.getByTestId('start').click(); await page.getByTestId('skip-intro').click();
    await until(page, () => window.P5Debug.snapshot().mode === 'play', null, 15000);
    await objectiveIs(page, 'zh', 'A1');
    await expect(page.getByTestId('chapter')).toHaveText('序章 · 妈妈的书房');
    await follow(page, ctl, 'computer'); await useNear(page, ctl, 'computer'); await settle(page, ctl);
    await objectiveIs(page, 'zh', 'A2');
    await shot(page, testInfo, 'zh-02-study');
    await seedSave(page, townState({ flags: { theoMet: true } }));
    await page.getByTestId('continue').click();
    await until(page, () => window.P5Debug.snapshot().mode === 'play', null, 15000);
    await objectiveIs(page, 'zh', 'B2');
    await follow(page, ctl, 'gap'); await useNear(page, ctl, 'gap'); await settle(page, ctl);
    await until(page, () => window.P5Debug.snapshot().mode === 'reader', null, 15000);
    await expect(page.getByTestId('copy-mirror')).toContainText('中途截断');
    await page.getByTestId('toggle-disk').click();
    await expect(page.getByTestId('bridge-result')).toContainText('有一份完整的副本');
    await shot(page, testInfo, 'zh-03-reader');
    await page.getByTestId('reader-close').click();
    await until(page, () => { const q = window.P5Debug.snapshot(); return q.mode === 'play' && q.nearHold; }, null, 15000);
    await expect(page.getByTestId('prompt')).toContainText('按住');
    await page.keyboard.down('e'); await until(page, () => window.P5Debug.snapshot().bridge >= 1, null, 30000); await page.keyboard.up('e');
    await settle(page, ctl, async (d) => { if (d.key === 'theo.planks') { await shot(page, testInfo, 'zh-04-bridge'); } });
    await objectiveIs(page, 'zh', 'B5');
    await shot(page, testInfo, 'zh-05-bridge-done');
    expect(issues, issues.join('\n')).toEqual([]);
  });
});

// ---- phone, touch only -----------------------------------------------------------------------------------
test.describe('P5 phone', () => {
  test.use({ viewport: devices['Pixel 5'].viewport, userAgent: devices['Pixel 5'].userAgent, deviceScaleFactor: devices['Pixel 5'].deviceScaleFactor, isMobile: true, hasTouch: true });
  test.setTimeout(400000);
  test('touch stick, the archive button and holding the hand rebuild the bridge', async ({ page }, testInfo) => {
    const issues = []; watch(page, issues);
    const ctl = { kind: 'touch', stick: stickDriver(page) };
    await seedSave(page, townState({ flags: { theoMet: true, gapSeen: true, readerSeen: true } }));
    await page.getByTestId('continue').tap();
    await until(page, () => window.P5Debug.snapshot().mode === 'play', null, 15000);
    await expect(page.getByTestId('stick')).toBeVisible();
    for (const id of ['stick', 'use']) { const b = await page.getByTestId(id).boundingBox(); expect(b.width).toBeGreaterThanOrEqual(64); expect(b.height).toBeGreaterThanOrEqual(64); }
    const vp = page.viewportSize(); const hud = await page.getByTestId('hud').boundingBox();
    expect(hud.x + hud.width).toBeLessThanOrEqual(vp.width); expect(hud.height).toBeLessThan(vp.height * 0.22);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await shot(page, testInfo, 'phone-01-town');
    await page.getByTestId('archive').tap();
    await until(page, () => window.P5Debug.snapshot().mode === 'reader', null, 10000);
    await page.getByTestId('toggle-disk').tap();
    await expect(page.getByTestId('bridge-result')).toHaveAttribute('data-status', 'ok');
    await shot(page, testInfo, 'phone-02-reader');
    await page.getByTestId('reader-close').tap();
    await follow(page, ctl, 'gap');
    await until(page, () => window.P5Debug.snapshot().nearHold, null, 15000);
    await page.getByTestId('use').dispatchEvent('pointerdown', { pointerType: 'touch' });
    await until(page, () => window.P5Debug.snapshot().bridge >= 1, null, 30000);
    await page.getByTestId('use').dispatchEvent('pointerup', { pointerType: 'touch' });
    await settle(page, ctl);
    await objectiveIs(page, 'en', 'B5');
    await page.waitForTimeout(400);
    await shot(page, testInfo, 'phone-03-bridge');
    expect(issues, issues.join('\n')).toEqual([]);
  });
});

// ---- focused checks ----------------------------------------------------------------------------------------
test.describe('P5 focused checks', () => {
  test.use({ viewport: { width: 1280, height: 720 } });
  test.setTimeout(240000);

  test('without a complete copy, holding E at the gap builds nothing', async ({ page }) => {
    const ctl = { kind: 'keys', keys: keyDriver(page) };
    await seedSave(page, townState({ flags: { theoMet: true, gapSeen: true, readerSeen: true }, pos: { town: { x: 0, z: 7.6, yaw: Math.PI } } }));
    await page.getByTestId('continue').click();
    await until(page, () => window.P5Debug.snapshot().mode === 'play', null, 15000);
    await until(page, () => window.P5Debug.snapshot().near === 'gap', null, 15000);
    let s = await snap(page); expect(s.nearHold).toBe(false); expect(s.step).toBe('B3');
    await page.keyboard.down('e'); await page.waitForTimeout(2500); await page.keyboard.up('e');
    await settle(page, ctl);
    s = await snap(page); expect(s.bridge).toBe(0); expect(s.bridgeLen).toBe(0);
    if (s.mode === 'reader') { await expect(page.getByTestId('bridge-result')).toHaveAttribute('data-status', 'damaged'); await page.keyboard.press('Escape'); }
    // the canal still cannot be crossed
    await walkTo(page, ctl, 0, 12.5, 0.3).catch(() => {});
    expect((await snap(page)).z).toBeLessThan(8.4);
  });

  test('switching builds anywhere never leaves Mara inside an obstacle', async ({ page }) => {
    const ctl = { kind: 'keys', keys: keyDriver(page) };
    await seedSave(page, townState(Object.assign({}, DONE_BRIDGE, { flags: Object.assign({}, DONE_BRIDGE.flags, { theoTalked: true, switchUnlocked: true }), pos: { town: { x: 15.0, z: 17.0, yaw: 0 } } })));
    await page.getByTestId('continue').click();
    await until(page, () => window.P5Debug.snapshot().mode === 'play', null, 15000);
    let s = await snap(page); expect(s.build).toBe('2004'); expect(Math.hypot(s.x - 15, s.z - 17)).toBeLessThan(0.3);
    await page.keyboard.press('v');                                                   // the point has no path in 1998
    await until(page, () => window.P5Debug.snapshot().build === '1998' && !window.P5Debug.snapshot().busy, null, 15000);
    await settle(page, ctl);
    s = await snap(page); expect(s.standable).toBe(true); expect(s.safeCount).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('v'); await page.waitForTimeout(700); await settle(page, ctl);
      s = await snap(page); expect(s.standable).toBe(true);
      await walkTo(page, ctl, s.x + (i % 2 ? 1 : -1), s.z, 0.3).catch(() => {});      // and can still move
    }
  });

  test('a dialogue seen before can be skipped; a new one cannot', async ({ page }) => {
    const ctl = { kind: 'keys', keys: keyDriver(page) };
    await seedSave(page, townState(Object.assign({}, DONE_BRIDGE, { pos: { town: { x: 0.4, z: 6.4, yaw: 0 } } })), { 'p5.seenDialog.v1': ['theoPier'] });
    await page.getByTestId('continue').click();
    await until(page, () => window.P5Debug.snapshot().mode === 'play', null, 15000);
    await follow(page, ctl, 'theo'); await useNear(page, ctl, 'theo');
    await until(page, () => !!window.P5Debug.snapshot().dialog, null, 10000);
    await expect(page.getByTestId('skip-dialog')).toBeVisible();
    await page.keyboard.press('x');
    await until(page, () => !window.P5Debug.snapshot().dialog, null, 5000);
    await settle(page, ctl);
    expect((await snap(page)).step).toBe('C1');
    // a dialogue never seen: no skip
    await seedSave(page, townState({ pos: { town: { x: 0, z: 7.9, yaw: Math.PI } } }), { 'p5.seenDialog.v1': [] });
    await page.getByTestId('continue').click();
    await until(page, () => window.P5Debug.snapshot().near === 'theo', null, 15000);
    await press(page, ctl);
    await until(page, () => !!window.P5Debug.snapshot().dialog, null, 10000);
    await expect(page.getByTestId('skip-dialog')).toBeHidden();
    await page.keyboard.press('x'); await page.waitForTimeout(300);
    expect((await snap(page)).dialog).not.toBeNull();
  });

  test('hints: H steps through three levels; the menu returns to a safe spot', async ({ page }) => {
    await seedSave(page, townState({ flags: { theoMet: true, gapSeen: true } }));
    await page.getByTestId('continue').click();
    await until(page, () => window.P5Debug.snapshot().mode === 'play', null, 15000);
    await expect(page.getByTestId('hint')).toHaveText(await tr(page, 'en', 'hint.B3.0'));
    for (const l of [1, 2, 3, 3]) { await page.keyboard.press('h'); await expect(page.getByTestId('hint')).toHaveText(await tr(page, 'en', `hint.B3.${l}`)); }
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('safe-spot')).toBeVisible();
    await page.getByTestId('safe-spot').click();
    const s = await snap(page); expect(s.standable).toBe(true); expect(s.mode).toBe('play');
  });

  test('an edited save cannot skip the bridge', async ({ page }) => {
    await seedSave(page, townState({ bridge: 1, bridgeFrom: { messageId: '<fake@x.example>', source: 'disk', crc: '00000000' }, flags: { theoMet: true, gapSeen: true, theoCrossed: true, theoTalked: true, switchUnlocked: true, pierReached: true, anomaly: true }, build: '1998' }));
    await page.getByTestId('continue').click();
    await until(page, () => window.P5Debug.snapshot().mode === 'play', null, 15000);
    const s = await snap(page);
    expect(s.bridge).toBe(0); expect(s.step).toBe('B3'); expect(s.build).toBe('2004'); expect(s.bridgeLen).toBe(0);
  });

  test('reduced motion and settings are kept', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    await seedSave(page, townState());
    await expect(page.locator('html')).toHaveClass(/reduce-motion/);
    await page.getByTestId('continue').click();
    await until(page, () => window.P5Debug.snapshot().mode === 'play', null, 15000);
    await page.keyboard.press('Escape');
    await page.getByTestId('sound').click(); await page.getByTestId('volume').fill('40'); await page.getByTestId('textsize').click();
    await page.reload(); await page.waitForFunction(() => window.P5Debug && document.querySelector('[data-testid="continue"]'));
    expect(await page.evaluate(() => localStorage.getItem('p5.muted.v1'))).toBe('1');
    expect(await page.evaluate(() => localStorage.getItem('p5.volume.v1'))).toBe('0.4');
    await expect(page.locator('html')).toHaveClass(/large-text/);
    await ctx.close();
  });

  test('older versions stay where they were', async ({ page }) => {
    expect((await page.goto('/')).status()).toBe(200);
    expect((await page.goto('/p3/')).status()).toBe(200);
    expect((await page.goto('/p4/')).status()).toBe(200);
    await page.waitForFunction(() => window.P4Debug);
    expect((await page.request.get('/api/health')).ok()).toBe(true);
  });
});
