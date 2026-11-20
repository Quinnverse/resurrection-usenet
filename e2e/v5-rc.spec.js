// RC1 review tooling in real Chromium (software GPU on CI; nothing here says anything about a real GPU):
//  - key remapping with conflicts, reserved keys, Esc to cancel, persistence and repair of damaged settings,
//  - ?preview=<beat> for the key scenes (real screenshots, the real save is left alone),
//  - ?bench=... frame-time tour and its report, over http and from a file,
//  - the review hub and the gamepad monitor, the single-file builds opened from disk (no server, no network),
//  - touch layout in portrait and landscape on phone-sized screens, including a rotation.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--enable-precise-memory-info', '--autoplay-policy=no-user-gesture-required'] }, viewport: { width: 1280, height: 720 }, video: 'off' });

function watch(page, opts) {
  const issues = [], failed = [], external = [];
  page.on('pageerror', (e) => issues.push('page error: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) { issues.push('console: ' + m.text()); } });
  page.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) { failed.push(r.status() + ' ' + r.url()); } });
  page.on('request', (r) => { if (!/^(file|data|blob|about):/.test(r.url())) { external.push(r.url()); } });
  return { issues, failed, external };
}
const snap = (page) => page.evaluate(() => window.V5Debug.snapshot());
async function attach(testInfo, name, buf) { await testInfo.attach(name, { body: buf, contentType: 'image/jpeg' }); if (process.env.CI) { console.log(`V5_SHOT ${name} ${buf.toString('base64')}`); } }
const shot = (page) => page.screenshot({ type: 'jpeg', quality: 70 });
const PREFS = { lang: 'en', quality: 'low' };
const withPrefs = (page, prefs) => page.addInitScript((p) => { try { if (!sessionStorage.getItem('rc.prefs')) { localStorage.setItem('v5.prefs.v1', JSON.stringify(p)); sessionStorage.setItem('rc.prefs', '1'); } } catch (e) { /* ignore */ } }, prefs || PREFS);
function installPad() {
  const pad = { id: 'simulated standard gamepad', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  window.__pad = pad; navigator.getGamepads = () => [pad, null, null, null];
  window.__press = (i, on) => { pad.buttons[i].pressed = on; pad.buttons[i].value = on ? 1 : 0; pad.timestamp += 1; };
}
async function startGame(page) { await page.goto('/v5/'); await expect(page.getByTestId('title')).toBeVisible({ timeout: 30000 }); await page.keyboard.press('Enter'); await expect.poll(async () => (await snap(page)).mode, { timeout: 15000 }).toBe('play'); }
const SIX = ['2.train', '3.ride', '3.beam', '4.porch', '6.beach', 'end'];

test.describe('V5 RC1 review tooling', () => {
  test('key remapping: conflicts swap, reserved keys are refused, Esc cancels, bindings persist, damaged settings are repaired', async ({ page }, testInfo) => {
    const w = watch(page); await withPrefs(page); await startGame(page);
    await page.keyboard.press('Escape'); await page.getByTestId('settings').click();
    // a key another action uses: the two swap
    await page.getByTestId('key-forward').click(); await page.keyboard.press('KeyD');
    await expect(page.getByTestId('key-forward')).toHaveText('Forward: D'); await expect(page.getByTestId('key-right')).toHaveText('Right: W'); await expect(page.getByTestId('key-note')).toContainText('swapped');
    // a key the game needs: refused, still waiting for another key; Esc cancels only the rebinding
    await page.getByTestId('key-use').click(); await page.keyboard.press('Digit1');
    await expect(page.getByTestId('key-note')).toContainText('uses that key'); await expect(page.getByTestId('key-use')).toContainText('Press a key');
    await page.keyboard.press('Escape'); await expect(page.getByTestId('key-use')).toHaveText('Use: E'); expect((await snap(page)).mode).toBe('pause');
    await attach(testInfo, 'remap-settings', await shot(page));
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('v5.keys.v1')));
    expect(stored.forward).toBe('KeyD'); expect(stored.right).toBe('KeyW'); expect(new Set(Object.values(stored)).size).toBe(Object.keys(stored).length);
    // persisted across a reload
    await page.reload(); await expect(page.getByTestId('continue')).toBeVisible({ timeout: 30000 }); await page.keyboard.press('Enter');
    await page.keyboard.press('Escape'); await page.getByTestId('settings').click(); await expect(page.getByTestId('key-forward')).toHaveText('Forward: D');
    await page.getByTestId('reset-keys').click(); await expect(page.getByTestId('key-forward')).toHaveText('Forward: W');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('v5.keys.v1')).forward)).toBe('KeyW');
    // damaged stored settings: Esc bound to a movement key, duplicates, junk. The game starts and the defaults apply.
    await page.evaluate(() => localStorage.setItem('v5.keys.v1', JSON.stringify({ forward: 'Escape', back: 'KeyS', left: 'KeyS', jump: { x: 1 }, use: 42 })));
    await page.reload(); await expect(page.getByTestId('continue')).toBeVisible({ timeout: 30000 }); await page.keyboard.press('Enter');
    await page.keyboard.press('Escape'); await page.getByTestId('settings').click();
    await expect(page.getByTestId('key-forward')).toHaveText('Forward: W'); await expect(page.getByTestId('key-left')).toHaveText('Left: A');
    expect(w.issues).toEqual([]);
  });

  test('previews: the key scenes open at the right moment, render, and leave the real save alone', async ({ page }, testInfo) => {
    test.setTimeout(10 * 60 * 1000);
    const w = watch(page); await withPrefs(page);
    await page.goto('/v5/'); const sentinel = JSON.stringify({ schemaVersion: 1, beat: 'sentinel' });
    for (const beat of SIX.concat(['4.duet'])) {
      await page.evaluate((s) => localStorage.setItem('v5.save.v1', s), sentinel);
      await page.goto('/v5/?preview=' + beat);
      await expect.poll(async () => (await snap(page).catch(() => ({}))).beat, { timeout: 60000 }).toBe(beat);
      expect((await snap(page)).mode).toBe('play'); await expect(page.getByTestId('tip')).toContainText('Nothing here is saved');
      await page.waitForTimeout(3500);   // let the scene settle and the autosave timer (5 s of game time) have its chance
      await attach(testInfo, `preview-${beat}`, await shot(page));
      expect(await page.evaluate(() => localStorage.getItem('v5.save.v1')), 'the real save is untouched in ' + beat).toBe(sentinel);
    }
    // the Chinese interface, and an unknown beat falls back to the title
    await page.goto('/v5/?preview=6.beach&lang=zh'); await expect.poll(async () => (await snap(page).catch(() => ({}))).beat, { timeout: 60000 }).toBe('6.beach'); expect((await snap(page)).lang).toBe('zh');
    await attach(testInfo, 'preview-6.beach-zh', await shot(page));
    await page.goto('/v5/?preview=nonsense'); await expect(page.getByTestId('title')).toBeVisible({ timeout: 30000 });
    expect(w.issues).toEqual([]); expect(w.failed).toEqual([]);
  });

  test('frame-time tour: two quality levels, report with the numbers, the real save and settings untouched', async ({ page }, testInfo) => {
    test.setTimeout(12 * 60 * 1000);
    const w = watch(page); await page.goto('/v5/'); await page.evaluate(() => { localStorage.setItem('v5.prefs.v1', JSON.stringify({ lang: 'en', quality: 'high' })); localStorage.setItem('v5.save.v1', JSON.stringify({ schemaVersion: 1, beat: 'sentinel' })); localStorage.removeItem('v5.bench.v1'); });
    await page.goto('/v5/?bench=low,medium&beats=1.study,2.train&secs=3&warm=1');
    await expect(page.getByTestId('bench-md')).toBeVisible({ timeout: 9 * 60 * 1000 });
    const rep = await page.evaluate(() => window.V5BenchReport); const md = await page.getByTestId('bench-md').textContent();
    console.log('V5_BENCH ' + JSON.stringify({ device: rep.device, results: rep.results.map((r) => ({ tier: r.tier, beat: r.beat, loadMs: Math.round(r.loadMs), stats: r.stats, heapMB: r.heapMB, calls: r.calls, triangles: r.triangles })) }));
    expect(rep.results.map((r) => r.tier + ':' + r.beat)).toEqual(['low:1.study', 'low:2.train', 'medium:1.study', 'medium:2.train']);
    rep.results.forEach((r) => { expect(r.stats.frames, r.tier + r.beat).toBeGreaterThan(2); expect(r.stats.avgFps).toBeGreaterThan(0); expect(r.stats.low1Fps).toBeGreaterThan(0); expect(r.calls).toBeGreaterThan(0); expect(r.triangles).toBeGreaterThan(0); });
    expect(rep.device.gpu).toBeTruthy(); expect(rep.device.browser).toMatch(/Chrome/); expect(rep.device.refreshHz).toBeGreaterThan(20);
    expect(md).toContain('| low | 1.study'); expect(md).toContain('| medium | 2.train'); expect(md).toContain('Lowest scene 1% low FPS');
    await expect(page.getByTestId('bench-copy')).toBeVisible(); await expect(page.getByTestId('bench-json')).toBeVisible();
    await attach(testInfo, 'bench-report', await shot(page));
    const after = await page.evaluate(() => ({ save: localStorage.getItem('v5.save.v1'), prefs: JSON.parse(localStorage.getItem('v5.prefs.v1')) }));
    expect(after.save).toContain('sentinel'); expect(after.prefs.quality).toBe('high');
    expect(w.issues).toEqual([]); expect(w.failed).toEqual([]);
  });

  test('review hub: key scene cards with screenshots, live links, device report and the gamepad monitor', async ({ page }, testInfo) => {
    const w = watch(page); await page.addInitScript(installPad); await page.goto('/v5/rc');
    await expect.poll(() => page.evaluate(() => !!(window.V5RC && window.V5RC.ready))).toBe(true);
    for (const beat of SIX.concat(['4.duet'])) { await expect(page.getByTestId('scene-' + beat)).toBeVisible(); expect(await page.getByTestId('open-' + beat).getAttribute('href')).toContain('preview=' + beat); }
    const broken = await page.evaluate(() => [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src));
    expect(broken, 'every screenshot loads').toEqual([]);
    await expect(page.locator('#device')).toContainText('WebGL'); await expect(page.locator('#device')).toContainText('Graphics card');
    // the gamepad monitor sees the simulated standard pad and lights the pressed button
    await expect(page.getByTestId('pad-info')).toContainText('mapping “standard”'); await expect(page.getByTestId('pad-verdict')).toContainText('Standard mapping');
    await page.evaluate(() => window.__press(0, true)); await page.waitForTimeout(300);
    expect(await page.evaluate(() => [...document.querySelectorAll('.btns span.on')].map((s) => s.textContent))).toEqual(['A']);
    await attach(testInfo, 'hub', await page.screenshot({ type: 'jpeg', quality: 70, fullPage: true }));
    // a link opens the scene
    await page.getByTestId('open-3.beam').click(); await expect.poll(async () => (await snap(page).catch(() => ({}))).beat, { timeout: 60000 }).toBe('3.beam');
    expect(w.issues).toEqual([]);
  });

  test('single files opened from disk: hub, game, playtest consent, audio page and a frame-time tour, with no network at all', async ({ browser }, testInfo) => {
    test.setTimeout(10 * 60 * 1000);
    const { buildAll } = await import(pathToFileURL(path.join(__dirname, '..', 'tools', 'v5-bundle.mjs')).href);
    const out = testInfo.outputPath('rc1'); buildAll(out); const url = (f, q) => pathToFileURL(path.join(out, f)).href + (q || '');
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); const page = await ctx.newPage(); const w = watch(page);
    // 1 the hub, and a scene link from it
    await page.goto(url('Resurrection-V5-RC.html')); await expect.poll(() => page.evaluate(() => !!(window.V5RC && window.V5RC.ready))).toBe(true);
    await expect(page.locator('#mode')).toContainText('Standalone');
    expect(await page.evaluate(() => [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).length)).toBe(0);
    await page.getByTestId('open-4.porch').click(); await expect.poll(async () => (await snap(page).catch(() => ({}))).beat, { timeout: 90000 }).toBe('4.porch');
    await page.waitForTimeout(2500); await attach(testInfo, 'file-preview-4.porch', await shot(page));
    // 2 the game: start, walk with real keys, pause, reload and Continue (saves work from a file)
    await page.goto(url('Resurrection-V5.html')); await expect(page.getByTestId('start')).toBeVisible({ timeout: 60000 }); await page.keyboard.press('Enter');
    await expect.poll(async () => (await snap(page)).mode, { timeout: 15000 }).toBe('play'); await page.waitForTimeout(1500);
    const a = await snap(page); await page.keyboard.down('KeyW'); await page.waitForTimeout(2500); await page.keyboard.up('KeyW'); await page.waitForTimeout(300); const b = await snap(page);
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(0.3);
    await page.keyboard.press('Escape'); expect((await snap(page)).mode).toBe('pause'); await page.getByTestId('resume').click(); await page.waitForTimeout(6000);
    await page.reload(); await expect(page.getByTestId('continue')).toBeVisible({ timeout: 60000 });
    await attach(testInfo, 'file-game-title', await shot(page));
    // 3 the playtest build: the notice is on the title, nothing is stored until Start, then the record exists and can be deleted
    await page.goto(url('Resurrection-V5-Playtest.html')); await expect(page.getByTestId('pt-tester')).toBeVisible({ timeout: 60000 });
    await expect(page.locator('.note.pt')).toContainText('Pressing Start or Continue means you agree');
    expect(await page.evaluate(() => localStorage.getItem('v5.playtest.v1'))).toBeNull();
    await page.getByTestId('pt-tester').fill('P99'); await page.getByTestId('start').click(); await expect.poll(async () => (await snap(page)).mode, { timeout: 15000 }).toBe('play'); await page.waitForTimeout(2000);
    const log = await page.evaluate(() => JSON.parse(localStorage.getItem('v5.playtest.v1'))); expect(log.tester).toBe('P99'); expect(log.version).toBe(2); expect(log.chapters[1].startedAt).toBeTruthy();
    await page.keyboard.press('Escape'); await expect(page.getByTestId('pt-download')).toBeVisible(); await expect(page.getByTestId('pt-delete')).toBeVisible();
    await attach(testInfo, 'file-playtest-pause', await shot(page));
    await page.getByTestId('pt-delete').click(); expect(await page.evaluate(() => localStorage.getItem('v5.playtest.v1'))).toBeNull();
    // 4 the audio page
    await page.goto(url('Resurrection-V5-Audio.html')); await page.waitForFunction(() => window.V5AudioReady, null, { timeout: 60000 });
    expect(await page.getByTestId('scene-night').getAttribute('href')).toContain('Resurrection-V5.html?preview=4.porch'); await expect(page.getByTestId('loop-night')).toBeVisible();
    // 5 a frame-time tour from a file
    await page.goto(url('Resurrection-V5.html', '?bench=low&beats=1.study&secs=1&warm=0')); await expect(page.getByTestId('bench-md')).toBeVisible({ timeout: 5 * 60 * 1000 });
    expect((await page.evaluate(() => window.V5BenchReport)).results.length).toBe(1);
    expect(w.external, 'the single files never touch the network').toEqual([]); expect(w.issues).toEqual([]); await ctx.close();
  });

  // ---- touch layout on phone-sized screens, both orientations, with a rotation ---------------------------------------
  const inside = (b, vp) => !!b && b.x >= -1 && b.y >= -1 && b.x + b.width <= vp.width + 1 && b.y + b.height <= vp.height + 1;
  const overlap = (a, b) => !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
  test('touch layout: buttons, menus and the title fit and do not overlap in portrait and landscape, and a rotation re-fits', async ({ browser }, testInfo) => {
    test.setTimeout(10 * 60 * 1000);
    const report = [];
    for (const [label, vp] of [['phone-portrait', { width: 390, height: 844 }], ['phone-landscape', { width: 844, height: 390 }], ['small-portrait', { width: 320, height: 568 }], ['small-landscape', { width: 568, height: 320 }]]) {
      const ctx = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }); const page = await ctx.newPage(); const w = watch(page); await withPrefs(page);
      await page.goto('/v5/'); await expect(page.getByTestId('title')).toBeVisible({ timeout: 30000 });
      const m = { label, vp, problems: [] }; const need = (ok, what) => { if (!ok) { m.problems.push(what); } };
      need(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page is wider than the screen');
      need(inside(await page.getByTestId('title').boundingBox(), vp), 'title box outside the screen'); need(inside(await page.getByTestId('start').boundingBox(), vp), 'Start outside the screen');
      await attach(testInfo, `touch-${label}-title`, await shot(page));
      await page.getByTestId('start').tap(); await expect.poll(async () => (await snap(page)).mode, { timeout: 15000 }).toBe('play'); await page.waitForTimeout(1500);
      const ids = ['jump', 'use', 'pause', 'hint']; const boxes = {};
      for (const id of ids) { boxes[id] = await page.getByTestId('touch-' + id).boundingBox(); need(inside(boxes[id], vp), `touch-${id} outside the screen`); need(boxes[id] && boxes[id].width >= 40 && boxes[id].height >= 40, `touch-${id} smaller than 40 px`); }
      for (let i = 0; i < ids.length; i++) { for (let j = i + 1; j < ids.length; j++) { need(!(boxes[ids[i]] && boxes[ids[j]] && overlap(boxes[ids[i]], boxes[ids[j]])), `touch-${ids[i]} overlaps touch-${ids[j]}`); } }
      await attach(testInfo, `touch-${label}-play`, await shot(page));
      await page.getByTestId('touch-pause').tap(); await expect(page.getByTestId('panel')).toBeVisible(); const pb = await page.getByTestId('panel').boundingBox(); need(inside(pb, vp), 'pause panel outside the screen');
      await page.getByTestId('settings').tap(); await page.waitForTimeout(300); need(inside(await page.getByTestId('panel').boundingBox(), vp), 'settings panel outside the screen');
      await page.getByTestId('resume').scrollIntoViewIfNeeded(); need(inside(await page.getByTestId('resume').boundingBox(), vp), 'Resume cannot be scrolled into view');
      await attach(testInfo, `touch-${label}-settings`, await shot(page));
      await page.getByTestId('resume').tap(); await page.waitForTimeout(300); need((await snap(page)).mode === 'play', 'Resume did not return to the game');
      // rotate: same page, other orientation
      await page.setViewportSize({ width: vp.height, height: vp.width }); await page.waitForTimeout(800);
      const rv = { width: vp.height, height: vp.width };
      const canvas = await page.evaluate(() => { const c = document.querySelector('[data-testid="canvas"]'); const r = c.getBoundingClientRect(); return { w: r.width, h: r.height, iw: innerWidth, ih: innerHeight, cw: c.width, ch: c.height }; });
      need(Math.abs(canvas.w - rv.width) < 2 && Math.abs(canvas.h - rv.height) < 2, `canvas is ${canvas.w}x${canvas.h} after rotating to ${rv.width}x${rv.height}`);
      need(Math.abs(canvas.cw / canvas.ch - rv.width / rv.height) < 0.1, 'drawing buffer aspect does not follow the rotation');
      for (const id of ids) { need(inside(await page.getByTestId('touch-' + id).boundingBox(), rv), `touch-${id} outside the screen after rotating`); }
      await attach(testInfo, `touch-${label}-rotated`, await shot(page));
      m.canvas = canvas; report.push(m); expect(w.issues).toEqual([]); await ctx.close();
    }
    console.log('V5_TOUCH_LAYOUT ' + JSON.stringify(report));
    report.forEach((m) => expect.soft(m.problems, m.label).toEqual([]));
  });
});
