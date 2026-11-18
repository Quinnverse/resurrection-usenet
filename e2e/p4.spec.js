// P4 browser acceptance in real Chromium (WebGL through SwiftShader in CI).
//
// A scripted player drives the game only through ordinary input: keys, mouse drags, touch-stick and button
// pointer events. It reads the read-only window.P4Debug.snapshot() to know where it is, the way a person looks at
// the screen; it never changes game state. Times printed as P4_TIME are automated, not human play time.
// Key screenshots are printed as P4_SHOT lines and a timestamped operation record as P4_REC lines (CI only).

const { test, expect, devices } = require('@playwright/test');
const path = require('node:path');
const zlib = require('node:zlib');
const { pathToFileURL } = require('node:url');

test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] }, video: { mode: 'on', size: { width: 1280, height: 720 } } });

const PATH = '/p4/';
let Lv = null;
async function levels() { if (!Lv) { Lv = await import(pathToFileURL(path.join(__dirname, '..', 'frontend', 'p4', 'js', 'levels.js')).href); } return Lv; }

// ---- evidence -------------------------------------------------------------------------------------------
async function shot(page, testInfo, name) {
  const buf = await page.screenshot({ type: 'jpeg', quality: 70 });
  await testInfo.attach(name, { body: buf, contentType: 'image/jpeg' });
  if (process.env.CI) { console.log(`P4_SHOT ${name} ${buf.toString('base64')}`); }
}
function recorder(page, testInfo, label) {
  const t0 = Date.now(); let n = 0;
  return async (action) => {
    const s = await snap(page);
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const line = `${secs}s | ${s.scene} | step ${s.step} | ${s.fps} fps q${s.quality} | ${action}`;
    testInfo.annotations.push({ type: 'record', description: line });
    if (process.env.CI) {
      const buf = await page.screenshot({ type: 'jpeg', quality: 38 });
      console.log(`P4_REC ${label} ${String(n).padStart(3, '0')} ${encodeURIComponent(line)} ${buf.toString('base64')}`);
    } else { console.log('REC', label, line); }
    n += 1;
  };
}
// Minimal PNG decoder (8-bit RGB/RGBA, non-interlaced) to measure how rich a real screenshot is.
function pngStats(buf) {
  let pos = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (pos < buf.length) { const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8); const data = buf.subarray(pos + 8, pos + 8 + len); if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; } if (type === 'IDAT') { idat.push(data); } pos += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (f === 1) { v += a; } else if (f === 2) { v += b; } else if (f === 3) { v += (a + b) >> 1; } else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * stride + x] = v & 255;
    }
  }
  const colours = new Set(); let edges = 0;
  for (let y = 0; y < h; y += 2) { for (let x = 0; x < w; x += 2) { const i = y * stride + x * bpp; colours.add((out[i] >> 3) + ',' + (out[i + 1] >> 3) + ',' + (out[i + 2] >> 3)); if (x > 1) { const j = i - 2 * bpp; if (Math.abs(out[i] - out[j]) + Math.abs(out[i + 1] - out[j + 1]) > 40) { edges++; } } } }
  return { colours: colours.size, edges };
}
async function sceneRichness(page) { return pngStats(await page.screenshot({ type: 'png' })); }

// ---- driving the game -----------------------------------------------------------------------------------
const snap = (page) => page.evaluate(() => window.P4Debug.snapshot());
const until = (page, fn, arg, timeout) => page.waitForFunction(fn, arg, { polling: 100, timeout: timeout || 30000 });
const tr = async (page, lang, key, vars) => page.evaluate(async ([l, k, v]) => (await import('/p4/js/i18n.js')).t(l, k, v), [lang, key, vars || null]);

function keyDriver(page) {
  const held = new Set();
  return {
    async set(keys) { for (const k of held) { if (!keys.has(k)) { await page.keyboard.up(k); held.delete(k); } } for (const k of keys) { if (!held.has(k)) { await page.keyboard.down(k); held.add(k); } } },
    async release() { await this.set(new Set()); }
  };
}
function stickDriver(page) {
  let down = false, box = null;
  return {
    async set(fx, fz) {
      if (!box) { box = await page.getByTestId('stick').boundingBox(); }
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      const x = cx + fx * box.width * 0.4, y = cy - fz * box.height * 0.4;
      if (!fx && !fz) { if (down) { await page.getByTestId('stick').dispatchEvent('pointerup', { pointerId: 7, clientX: cx, clientY: cy, pointerType: 'touch' }); down = false; } return; }
      if (!down) { await page.getByTestId('stick').dispatchEvent('pointerdown', { pointerId: 7, clientX: x, clientY: y, pointerType: 'touch', isPrimary: true }); down = true; }
      else { await page.getByTestId('stick').dispatchEvent('pointermove', { pointerId: 7, clientX: x, clientY: y, pointerType: 'touch' }); }
    },
    async release() { await this.set(0, 0); }
  };
}
// Steers toward (x, z) relative to the camera, the way a player would with W A S D or the stick.
async function walkTo(page, ctl, x, z, tol, stopIf) {
  const tolerance = tol || 0.3;
  const kd = ctl.kind === 'touch' ? null : ctl.keys;
  let lastProgress = Date.now(), best = Infinity;
  for (;;) {
    const s = await snap(page);
    const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz);
    if (d < tolerance || (stopIf && stopIf(s))) { break; }
    if (d < best - 0.05) { best = d; lastProgress = Date.now(); }
    if (Date.now() - lastProgress > 9000) { if (kd) { await kd.release(); } else { await ctl.stick.release(); } throw new Error(`stuck walking to ${x},${z}: ${JSON.stringify({ x: s.x, z: s.z, scene: s.scene, busy: s.busy, dialog: s.dialog })}`); }
    if (s.busy || s.dialog) { if (kd) { await kd.release(); } else { await ctl.stick.release(); } await page.waitForTimeout(150); continue; }
    const fwdX = -Math.sin(s.yaw), fwdZ = -Math.cos(s.yaw), rgtX = Math.cos(s.yaw), rgtZ = -Math.sin(s.yaw);
    const fz = (dx * fwdX + dz * fwdZ) / d, fx = (dx * rgtX + dz * rgtZ) / d;
    if (kd) {
      const keys = new Set();
      if (Date.now() - lastProgress > 2000) {
        // caught on a corner: like a player, try one straight direction for a moment
        const alt = Math.floor((Date.now() - lastProgress) / 1000) % 2 === 0;
        if (alt) { keys.add(fz >= 0 ? 'w' : 's'); } else { keys.add(fx >= 0 ? 'd' : 'a'); }
      } else {
        if (fz > 0.38) { keys.add('w'); } if (fz < -0.38) { keys.add('s'); } if (fx > 0.38) { keys.add('d'); } if (fx < -0.38) { keys.add('a'); }
      }
      await kd.set(keys);
    } else { await ctl.stick.set(fx, fz); }
    await page.waitForTimeout(45);
  }
  if (kd) { await kd.release(); } else { await ctl.stick.release(); }
}
async function follow(page, ctl, scene, id) {
  const L = await levels();
  if (L.PATHS[scene]) {
    const s = await snap(page);
    const extra = s.theo && s.theo.visible ? [{ k: 'circ', x: s.theo.x, z: s.theo.z, r: 0.42 }] : null;
    const path = L.plan(scene, s.x, s.z, L.GOALS[scene][id], extra);
    if (!path) { throw new Error(`no path to ${id} from ${s.x},${s.z}`); }
    for (const [x, z] of path) { await walkTo(page, ctl, x, z, 0.3); }
  } else {
    for (const [x, z] of L.ROUTES[scene][id]) { await walkTo(page, ctl, x, z, 0.35); }
  }
  // like a player who sees no prompt yet: take a step or two toward the thing until its prompt appears
  const p = L.point(scene, id);
  if (p && (await snap(page)).near !== id) { await walkTo(page, ctl, p.x, p.z, 0.5, (s) => s.near === id); }
}
async function useNear(page, ctl, id) {
  await until(page, (want) => { const s = window.P4Debug.snapshot(); return s.near === want && !s.busy && !s.dialog; }, id, 15000);
  if (ctl.kind === 'touch') { await page.getByTestId('use').dispatchEvent('pointerdown', { pointerType: 'touch' }); } else { await page.keyboard.press('e'); }
  await page.waitForTimeout(250);
}
// Reads every dialogue line to the end with E (or taps), waits for scene changes and cutscenes to finish.
async function settle(page, ctl, onLine, onBusy) {
  const seen = [];
  for (let i = 0; i < 200; i++) {
    const s = await snap(page);
    if (s.dialog) {
      if (seen.indexOf(s.dialog.key + s.dialog.i) < 0) { seen.push(s.dialog.key + s.dialog.i); if (onLine) { await onLine(s.dialog); } }
      await page.waitForTimeout(350);
      if (ctl.kind === 'touch') { await page.getByTestId('use').dispatchEvent('pointerdown', { pointerType: 'touch' }); } else { await page.keyboard.press('e'); }
      await page.waitForTimeout(120);
      continue;
    }
    if (s.busy && onBusy) { await onBusy(s); }
    if (!s.busy && s.mode !== 'intro') { await page.waitForTimeout(250); const s2 = await snap(page); if (!s2.busy && !s2.dialog) { return seen; } }
    await page.waitForTimeout(200);
  }
  throw new Error('never settled: ' + JSON.stringify(await snap(page)));
}
async function visit(page, ctl, scene, id, onLine) { await follow(page, ctl, scene, id); await useNear(page, ctl, id); return settle(page, ctl, onLine); }
async function objectiveIs(page, lang, key, vars) { await expect(page.getByTestId('objective')).toHaveText(await tr(page, lang, key, vars), { timeout: 15000 }); }
async function seedSave(page, state) {
  await page.goto(PATH); await page.waitForFunction(() => window.P4Debug);
  await page.evaluate((s) => localStorage.setItem('p4.save.v1', JSON.stringify(s)), state);
  await page.reload(); await page.waitForFunction(() => window.P4Debug);
}
function baseState(over) {
  const flags = { lamp: true, crtOn: true, archiveIntro: true, plaza: false, account: false, townIntro: false, theoMet: false, copy98: false, copy04: false, restored: false, lit: false, ended: false, introSeen: true };
  return Object.assign({ v: 1, scene: 'study', step: 'A1', pos: {}, seen: [], view: null }, over, { flags: Object.assign(flags, (over && over.flags) || {}) });
}
function watch(page, issues) {
  page.on('pageerror', (e) => issues.push('page error: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) { issues.push('console: ' + m.text()); } });
}

// ---- the full English playthrough --------------------------------------------------------------------------
test.describe('P4 full playthrough', () => {
  test.use({ viewport: { width: 1280, height: 720 } });
  test.setTimeout(1000000);

  test('English, keyboard and mouse: study, archive, town, restoration, ending, resume', async ({ page }, testInfo) => {
    const issues = []; watch(page, issues);
    const ctl = { kind: 'keys', keys: keyDriver(page) };
    const rec = recorder(page, testInfo, 'en');
    const marks = {}; let t0 = 0; const mark = (k) => { marks[k] = (Date.now() - t0) / 1000; };
    await page.goto(PATH);
    await page.waitForFunction(() => window.P4Debug && window.P4Debug.snapshot().frames > 10);
    await expect(page.getByTestId('start')).toBeVisible();
    await shot(page, testInfo, '01-title');
    const rich = await sceneRichness(page);
    expect(rich.colours, 'the title shows a real 3D scene, not a flat block').toBeGreaterThan(400);
    await rec('title screen');

    // A. the study
    t0 = Date.now();
    await page.getByTestId('start').click();
    await expect(page.getByTestId('intro')).toBeVisible();
    await page.waitForTimeout(2500); await shot(page, testInfo, '02-intro'); await rec('intro: “Mom died last spring.”');
    await until(page, () => window.P4Debug.snapshot().mode === 'play', null, 20000);
    await objectiveIs(page, 'en', 'obj.A1'); mark('objective-visible');
    await expect(page.getByTestId('tutorial')).toContainText(await tr(page, 'en', 'tut.move'));
    await shot(page, testInfo, '03-study-objective'); await rec('objective shown: pack up Mom’s study · tip: move');
    // first move, then look around with the mouse
    await walkTo(page, ctl, 0.2, -0.9, 0.3);
    await expect(page.getByTestId('tutorial')).toContainText(await tr(page, 'en', 'tut.look'));
    const box = await page.getByTestId('canvas').boundingBox();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5); await page.mouse.down();
    for (let i = 0; i < 12; i++) { await page.mouse.move(box.x + box.width * 0.6 - i * 14, box.y + box.height * 0.5 + i * 1.5); await page.waitForTimeout(30); }
    for (let i = 12; i > 0; i--) { await page.mouse.move(box.x + box.width * 0.6 - i * 14, box.y + box.height * 0.5); await page.waitForTimeout(30); }
    await page.mouse.up();
    expect((await snap(page)).tutorial).toBeGreaterThanOrEqual(2);
    await shot(page, testInfo, '04-study-look'); await rec('looked around with the mouse');
    // the KEEP box: the prompt appears, reading it wakes the computer
    await follow(page, ctl, 'study', 'keepbox');
    await expect(page.getByTestId('prompt')).toBeVisible();
    await expect(page.getByTestId('tutorial')).toContainText(await tr(page, 'en', 'tut.inspect'));
    await shot(page, testInfo, '05-study-prompt'); await rec('prompt: [E] Inspect · Box marked KEEP');
    await useNear(page, ctl, 'keepbox');
    await expect(page.getByTestId('dialog')).toBeVisible();
    await shot(page, testInfo, '06-study-keepbox'); await rec('read the KEEP box: a mixtape “music by J.”');
    await settle(page, ctl);
    await objectiveIs(page, 'en', 'obj.A2'); mark('first-discovery');
    await page.waitForTimeout(900);
    await shot(page, testInfo, '07-study-crt-wakes'); await rec('the computer turns on by itself · new objective');
    // the photo on the cork board (optional, but it is the first real mystery)
    await visit(page, ctl, 'study', 'photo', async (d) => { if (d.key === 'say.photo') { await shot(page, testInfo, '08-study-photo'); await rec('the photo: “J. — don’t let them forget you.”'); } });
    // the computer
    await follow(page, ctl, 'study', 'computer');
    await shot(page, testInfo, '09-study-computer'); await rec('at Mom’s computer');
    await useNear(page, ctl, 'computer');
    await settle(page, ctl, async (d) => { if (d.key === 'scr.3') { await shot(page, testInfo, '10-study-screen'); await rec('screen: 1 unread message in alt.games.homebrew'); } });

    // B. the archive
    await until(page, () => window.P4Debug.snapshot().scene === 'archive', null, 20000);
    await settle(page, ctl);
    await objectiveIs(page, 'en', 'obj.B1'); mark('archive');
    await page.waitForTimeout(500);
    await shot(page, testInfo, '11-archive-arrival'); await rec('arrived in the old internet');
    expect((await sceneRichness(page)).colours).toBeGreaterThan(250);
    await follow(page, ctl, 'archive', 'plaza');
    await until(page, () => window.P4Debug.snapshot().flags.plaza, null, 15000);
    await shot(page, testInfo, '12-archive-plaza'); await rec('the newsgroup plaza; alt.games.homebrew glows amber');
    await visit(page, ctl, 'archive', 'sky', async (d) => { if (d.key === 'say.sky') { await shot(page, testInfo, '13-archive-skylark'); await rec('skylark’s post: “everyone in it is someone I love. — E.”'); } });
    await objectiveIs(page, 'en', 'obj.B2');
    await page.waitForTimeout(1200);
    await shot(page, testInfo, '14-archive-gate-opens'); await rec('the gate opens');
    await visit(page, ctl, 'archive', 'gate');

    // C. Summer Town
    await until(page, () => window.P4Debug.snapshot().scene === 'town', null, 20000);
    await settle(page, ctl);
    await objectiveIs(page, 'en', 'obj.C1'); mark('town');
    await page.waitForTimeout(400);
    await shot(page, testInfo, '15-town-arrival'); await rec('Summer Town');
    expect((await sceneRichness(page)).colours).toBeGreaterThan(400);
    await follow(page, ctl, 'town', 'theo');
    await shot(page, testInfo, '16-town-theo-before'); await rec('Theo waits by the dark lighthouse');
    await useNear(page, ctl, 'theo');
    await settle(page, ctl, async (d) => { if (d.key === 'theo.1') { await shot(page, testInfo, '17-town-theo-talk'); await rec('Theo: “Elena? Is that you?”'); } });
    await objectiveIs(page, 'en', 'obj.C2', { n: 0 });
    // the two copies
    await visit(page, ctl, 'town', 'booth98');
    await expect(page.getByTestId('canvas')).toHaveClass(/view98/);
    await expect(page.getByTestId('viewing')).toBeVisible();
    await shot(page, testInfo, '18-town-copy-1998'); await rec('viewing the 1998 copy: warm, the lamp is there');
    await objectiveIs(page, 'en', 'obj.C2', { n: 1 });
    await visit(page, ctl, 'town', 'booth04');
    await expect(page.getByTestId('canvas')).toHaveClass(/view04/);
    await shot(page, testInfo, '19-town-copy-2004'); await rec('viewing the 2004 mirror: cold, no lamp, a face scraped off');
    await objectiveIs(page, 'en', 'obj.C3');
    // wrong copy: try to restore from the 2004 mirror at the lighthouse
    await follow(page, ctl, 'town', 'lighthouse');
    await useNear(page, ctl, 'lighthouse');
    const wrong = await settle(page, ctl);
    expect(wrong.some((k) => k.startsWith('say.lh04')) || (await snap(page)).caption === 'say.lh04').toBe(true);
    expect((await snap(page)).flags.restored).toBe(false);
    await shot(page, testInfo, '20-town-wrong-copy'); await rec('the 2004 copy has no lamp to restore');
    // walk back to the 1998 kiosk, switch to that copy, and return to the lighthouse
    await visit(page, ctl, 'town', 'booth98');
    await expect(page.getByTestId('canvas')).toHaveClass(/view98/);
    await follow(page, ctl, 'town', 'lighthouse');
    await expect(page.getByTestId('prompt')).toContainText(await tr(page, 'en', 'verb.restore'));
    await shot(page, testInfo, '21-town-restore-prompt'); await rec('at the lighthouse in the 1998 copy: [E] Restore the lamp');
    await useNear(page, ctl, 'lighthouse');
    await page.waitForTimeout(2600);
    await shot(page, testInfo, '22-town-restoring'); await rec('the lamp assembles from the old copy');
    await settle(page, ctl);
    await objectiveIs(page, 'en', 'obj.C4');
    expect((await snap(page)).flags.restored).toBe(true);
    await expect(page.getByTestId('canvas')).not.toHaveClass(/view98|view04/);
    mark('restored');
    await follow(page, ctl, 'town', 'theo');
    await shot(page, testInfo, '23-town-restored-dark'); await rec('back in the present: the lamp is there, still dark');
    await useNear(page, ctl, 'theo');
    let litShot = false;
    await settle(page, ctl, null, async (s) => { if (!litShot && s.lighting) { litShot = true; await page.waitForTimeout(5200); await shot(page, testInfo, '23b-town-lighting'); await rec('Theo climbs the lighthouse and lights the lamp'); } });
    expect(litShot, 'the lighting cutscene played').toBe(true);
    await until(page, () => window.P4Debug.snapshot().flags.lit, null, 30000);
    await objectiveIs(page, 'en', 'obj.C5'); mark('lit');
    await page.waitForTimeout(800);
    await shot(page, testInfo, '24-town-lit'); await rec('the lamp is lit: the beam sweeps the sea');
    await useNear(page, ctl, 'theo');
    await settle(page, ctl, async (d) => { if (d.key === 'theo.10') { await shot(page, testInfo, '25-town-theo-june'); await rec('Theo: someone erased June from the newer copies'); } });
    await expect(page.getByTestId('ending')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(3200);
    await expect(page.getByTestId('ending')).toContainText(await tr(page, 'en', 'end.subject'));
    mark('ending');
    await shot(page, testInfo, '26-ending'); await rec('new message from junebug, dated today: “Elena? Is that you?”');
    await page.getByTestId('keep-exploring').click();
    await objectiveIs(page, 'en', 'obj.END');
    const heard = (await snap(page)).heard;
    // resume: reload and continue in the same place
    const before = await snap(page);
    await page.reload(); await page.waitForFunction(() => window.P4Debug);
    await page.getByTestId('continue').click();
    await until(page, () => window.P4Debug.snapshot().mode === 'play', null, 15000);
    const after = await snap(page);
    expect(after.scene).toBe('town'); expect(after.step).toBe('END'); expect(after.flags.lit).toBe(true);
    expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeLessThan(1.0);
    await page.waitForTimeout(600);
    await shot(page, testInfo, '27-resumed'); await rec('reloaded and continued: still in Summer Town, lamp lit');

    console.log(`P4_TIME en total=${((Date.now() - t0) / 1000).toFixed(1)}s ` + Object.entries(marks).map(([k, v]) => `${k}=${v.toFixed(1)}s`).join(' ') + ` fps=${(await snap(page)).fps}  (automated, not human play time)`);
    expect(marks['objective-visible'], 'objective on screen within 30 s').toBeLessThan(30);
    expect(marks['first-discovery'], 'first discovery within 3 minutes').toBeLessThan(180);
    expect(heard).toEqual(expect.arrayContaining(['step', 'inspect', 'objective', 'crtWake', 'modem', 'gateOpen', 'portal', 'viewIn', 'restore', 'ignite', 'message']));
    expect(issues, issues.join('\n')).toEqual([]);
  });
});

// ---- Chinese ---------------------------------------------------------------------------------------------
test.describe('P4 Chinese', () => {
  test.use({ viewport: { width: 1280, height: 720 } });
  test.setTimeout(700000);

  test('Simplified Chinese: opening, tutorial, then the whole town chapter to the ending', async ({ page }, testInfo) => {
    const issues = []; watch(page, issues);
    const ctl = { kind: 'keys', keys: keyDriver(page) };
    await page.goto(PATH); await page.waitForFunction(() => window.P4Debug);
    await page.getByTestId('lang').click();
    await expect(page.getByTestId('start')).toHaveText('开始');
    await shot(page, testInfo, 'zh-01-title');
    await page.getByTestId('start').click();
    await page.getByTestId('skip-intro').click();
    await until(page, () => window.P4Debug.snapshot().mode === 'play', null, 15000);
    await objectiveIs(page, 'zh', 'obj.A1');
    await expect(page.getByTestId('tutorial')).toContainText('移动');
    await visit(page, ctl, 'study', 'keepbox');
    await objectiveIs(page, 'zh', 'obj.A2');
    await shot(page, testInfo, 'zh-02-study');
    // jump ahead with a save at the town entrance, then play the town chapter in Chinese
    await seedSave(page, baseState({ scene: 'town', step: 'C1', flags: { account: true, plaza: true } }));
    await page.getByTestId('continue').click();
    await until(page, () => window.P4Debug.snapshot().mode === 'play', null, 15000);
    await settle(page, ctl);
    await objectiveIs(page, 'zh', 'obj.C1');
    await visit(page, ctl, 'town', 'theo', async (d) => { if (d.key === 'theo.4') { await expect(page.getByTestId('dialog-text')).toHaveText(await tr(page, 'zh', 'theo.4'), { timeout: 15000 }); await shot(page, testInfo, 'zh-03-theo'); } });
    await visit(page, ctl, 'town', 'booth98');
    await shot(page, testInfo, 'zh-04-copy98');
    await visit(page, ctl, 'town', 'booth04');                     // switch to the 2004 mirror: both copies seen
    await objectiveIs(page, 'zh', 'obj.C3');
    await visit(page, ctl, 'town', 'booth98');                     // back to the 1998 copy
    await expect(page.getByTestId('canvas')).toHaveClass(/view98/);
    await follow(page, ctl, 'town', 'lighthouse');
    await expect(page.getByTestId('prompt')).toContainText('从这个副本恢复灯');
    await useNear(page, ctl, 'lighthouse'); await settle(page, ctl);
    await objectiveIs(page, 'zh', 'obj.C4');
    await follow(page, ctl, 'town', 'theo');
    await useNear(page, ctl, 'theo'); await settle(page, ctl);
    await until(page, () => window.P4Debug.snapshot().flags.lit, null, 30000);
    await useNear(page, ctl, 'theo'); await settle(page, ctl);
    await expect(page.getByTestId('ending')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(3200);
    await expect(page.getByTestId('ending')).toContainText('是谁重新点亮了灯塔？');
    await expect(page.getByTestId('ending')).toContainText('第二章 · 琼');
    await shot(page, testInfo, 'zh-05-ending');
    expect(issues, issues.join('\n')).toEqual([]);
  });
});

// ---- phone, touch only -------------------------------------------------------------------------------------
test.describe('P4 phone', () => {
  test.use({ viewport: devices['Pixel 5'].viewport, userAgent: devices['Pixel 5'].userAgent, deviceScaleFactor: devices['Pixel 5'].deviceScaleFactor, isMobile: true, hasTouch: true });
  test.setTimeout(300000);

  test('touch stick and hand button: find skylark in the archive and walk through the gate', async ({ page }, testInfo) => {
    const issues = []; watch(page, issues);
    const ctl = { kind: 'touch', stick: stickDriver(page) };
    await seedSave(page, baseState({ scene: 'archive', step: 'B1' }));
    await page.getByTestId('continue').tap();
    await until(page, () => window.P4Debug.snapshot().mode === 'play', null, 15000);
    await expect(page.getByTestId('stick')).toBeVisible();
    for (const id of ['stick', 'use']) { const b = await page.getByTestId(id).boundingBox(); expect(b.width).toBeGreaterThanOrEqual(64); expect(b.height).toBeGreaterThanOrEqual(64); }
    const ob = await page.getByTestId('objective').boundingBox(); const vp = page.viewportSize();
    expect(ob.x + ob.width).toBeLessThanOrEqual(vp.width); expect(ob.y).toBeGreaterThanOrEqual(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await shot(page, testInfo, 'phone-01-archive');
    await follow(page, ctl, 'archive', 'plaza');
    await visit(page, ctl, 'archive', 'sky');
    await objectiveIs(page, 'en', 'obj.B2');
    await shot(page, testInfo, 'phone-02-skylark');
    await visit(page, ctl, 'archive', 'gate');
    await until(page, () => window.P4Debug.snapshot().scene === 'town', null, 20000);
    await settle(page, ctl);
    await page.waitForTimeout(500);
    await shot(page, testInfo, 'phone-03-town');
    expect(issues, issues.join('\n')).toEqual([]);
  });
});

// ---- focused checks ----------------------------------------------------------------------------------------
test.describe('P4 focused checks', () => {
  test.use({ viewport: { width: 1280, height: 720 } });
  test.setTimeout(180000);

  test('autosave resumes the same place, and canceling New Game keeps the save', async ({ page }) => {
    const ctl = { kind: 'keys', keys: keyDriver(page) };
    await seedSave(page, baseState({ scene: 'study', step: 'A2', seen: ['keepbox'] }));
    await page.getByTestId('continue').click();
    await until(page, () => window.P4Debug.snapshot().mode === 'play', null, 15000);
    await objectiveIs(page, 'en', 'obj.A2');
    await walkTo(page, ctl, 2.0, -0.6);
    await page.waitForTimeout(4600);                                    // autosave runs every 4 s
    const before = await snap(page);
    await page.reload(); await page.waitForFunction(() => window.P4Debug);
    const saved = await page.evaluate(() => localStorage.getItem('p4.save.v1'));
    page.once('dialog', (d) => d.dismiss());
    await page.getByTestId('new-game').click();
    expect(await page.evaluate(() => localStorage.getItem('p4.save.v1'))).toBe(saved);
    await page.getByTestId('continue').click();
    await until(page, () => window.P4Debug.snapshot().mode === 'play', null, 15000);
    const after = await snap(page);
    expect(after.step).toBe('A2'); expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeLessThan(0.3);
  });

  test('reduced motion and settings: whole lines at once, settings saved', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage(); const ctl = { kind: 'keys', keys: keyDriver(page) };
    await seedSave(page, baseState({ scene: 'study', step: 'A1', flags: { crtOn: false } }));
    await expect(page.locator('html')).toHaveClass(/reduce-motion/);
    await page.getByTestId('continue').click();
    await until(page, () => window.P4Debug.snapshot().mode === 'play', null, 15000);
    await follow(page, ctl, 'study', 'photo'); await useNear(page, ctl, 'photo');
    await expect(page.getByTestId('dialog-text')).toHaveText(await tr(page, 'en', 'say.photo'));   // no typewriter
    await settle(page, ctl);
    await page.getByTestId('sound').click(); await page.getByTestId('volume').fill('40');
    await page.reload(); await page.waitForFunction(() => window.P4Debug);
    await expect(page.getByTestId('sound')).toHaveText('Sound: off');
    expect(await page.evaluate(() => localStorage.getItem('p4.volume.v1'))).toBe('0.4');
    await ctx.close();
  });

  test('a tampered save cannot skip the restoration', async ({ page }) => {
    await seedSave(page, baseState({ scene: 'town', step: 'END', flags: { account: true, theoMet: true, lit: true, ended: true } }));
    await page.getByTestId('continue').click();
    await until(page, () => window.P4Debug.snapshot().mode === 'play', null, 15000);
    const s = await snap(page);
    expect(s.step).toBe('C3'); expect(s.flags.lit).toBe(false);
  });

  test('older versions stay where they were', async ({ page }) => {
    expect((await page.goto('/')).status()).toBe(200);
    const p3 = await page.goto('/p3/'); expect(p3.status()).toBe(200);
    await expect(page).toHaveTitle(/Resurrection/);
    expect((await page.request.get('/api/health')).ok()).toBe(true);
  });
});
