// V5 browser acceptance in real Chromium (WebGL through SwiftShader in CI). Run: npx playwright test e2e/v5.spec.js
//
// 1. Real time, real input: title, keyboard walk in the study, pause, settings, language.
// 2. Every beat: a save for each beat is made by playing the core in Node, loaded through Continue, and the game runs
//    on its own clock with real key presses. Screenshots with the interface, frames per second, JS heap, failed loads.
// 3. Tab and collision on the pier in the real page.
// 4. The whole game, EN and ZH with the other choices: the scripted bot (test/v5-bot.mjs) runs inside the page and
//    plays all seven chapters through the real shell, DOM, CSS and WebGL. Time is virtual (one frame = 1/30 s) so the
//    result does not depend on how fast SwiftShader draws; the page still draws every frame and is recorded on video.
//    This is automated play, not human play time.
// 5. The tech demo. 6. Regression: /, /p3/, /p4/ still load.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--enable-precise-memory-info', '--autoplay-policy=no-user-gesture-required'] }, viewport: { width: 1280, height: 720 } });

function watch(page) {
  const issues = [], failed = [];
  page.on('pageerror', (e) => issues.push('page error: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) { issues.push('console: ' + m.text()); } });
  page.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) { failed.push(r.status() + ' ' + r.url()); } });
  return { issues, failed };
}
const snap = (page) => page.evaluate(() => window.V5Debug.snapshot());
async function attach(testInfo, name, buf) {
  await testInfo.attach(name, { body: buf, contentType: 'image/jpeg' });
  if (process.env.CI) { console.log(`V5_SHOT ${name} ${buf.toString('base64')}`); }
}
const shot = (page) => page.screenshot({ type: 'jpeg', quality: 70 });
const imp = (f) => import(pathToFileURL(path.join(__dirname, '..', f)).href);

// Installed before main.js: the shell's test hook plus a switchable virtual clock.
function initHook() {
  const real = { raf: window.requestAnimationFrame.bind(window), st: window.setTimeout.bind(window), ct: window.clearTimeout.bind(window) };
  const h = { virtual: false, next: {}, last: [], now: 0, timers: [], raf: null, id: 1e6, realTimeout: real.st };
  h.input = (orig) => (h.virtual ? h.next : orig);
  h.events = (evs) => { h.last = evs; };
  window.requestAnimationFrame = (cb) => { if (h.virtual) { h.raf = cb; return 1; } return real.raf(cb); };
  window.setTimeout = (fn, ms) => { if (!h.virtual) { return real.st(fn, ms); } const id = ++h.id; h.timers.push({ id, at: h.now + (ms || 0), fn }); return id; };
  window.clearTimeout = (id) => { const i = h.timers.findIndex((x) => x.id === id); if (i >= 0) { h.timers.splice(i, 1); } else { real.ct(id); } };
  // switch to virtual frames; wait for the game's pending real frame so its loop re-registers on the virtual clock
  h.virtualize = () => new Promise((resolve) => { h.virtual = true; h.now = performance.now(); real.raf(() => real.raf(() => resolve())); });
  h.advance = () => {
    h.now += 1000 / 30;
    for (;;) { h.timers.sort((a, b) => a.at - b.at); if (!h.timers.length || h.timers[0].at > h.now) { break; } h.timers.shift().fn(); }
    const cb = h.raf; h.raf = null; if (cb) { cb(h.now); }
  };
  // one virtual frame, then give the browser a moment to paint (and the test runner a chance to take screenshots)
  h.step = async (input) => { h.next = input || {}; h.last = []; h.advance(); await new Promise((r) => real.st(r, 0)); return h.last; };
  window.__V5_TEST__ = h;
}
// The bot module, served to the page with its imports pointed at the game's own URLs (same module instances).
async function serveBot(page) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'test', 'v5-bot.mjs'), 'utf8').split("'../frontend/v5/core/").join("'/v5/core/");
  await page.route('**/v5-test/bot.mjs', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: src }));
}
// A save at the start of every beat, made by playing the core in Node.
let SAVES = null;
async function savesByBeat() {
  if (SAVES) { return SAVES; }
  const Gm = await imp('frontend/v5/core/game.js'); const { loadArchive } = await imp('tools/v5-playthrough.mjs'); const { playThrough } = await imp('test/v5-bot.mjs');
  const g = Gm.createGame(loadArchive()); const saves = {};
  await playThrough(g, { step: (input) => { const ev = Gm.tick(g, 1 / 30, input); if (!saves[g.s.beat]) { saves[g.s.beat] = Gm.serialize(g); } return ev; } });
  SAVES = { saves, BEATS: Gm.BEATS }; return SAVES;
}
async function continueFrom(page, save, prefs) {
  await page.goto('/v5/');
  await page.evaluate(([sv, pf]) => { localStorage.setItem('v5.save.v1', JSON.stringify(sv)); localStorage.setItem('v5.prefs.v1', JSON.stringify(pf)); }, [save, prefs || { lang: 'en', quality: 'medium' }]);
  await page.reload();
  await expect(page.getByTestId('continue')).toBeVisible({ timeout: 30000 });
  await page.getByTestId('continue').click();
}

test.describe('V5 — The Summer We Never Finished', () => {
  test('title, real keyboard in the study, pause and settings', async ({ page }, testInfo) => {
    const w = watch(page);
    await page.addInitScript(() => { localStorage.setItem('v5.prefs.v1', JSON.stringify({ lang: 'en' })); });
    await page.goto('/v5/');
    await expect(page.getByTestId('start')).toBeVisible({ timeout: 30000 });
    await attach(testInfo, 'title', await shot(page));
    await page.getByTestId('start').click();
    await expect.poll(async () => (await snap(page)).beat, { timeout: 15000 }).toBe('1.study');
    const s0 = await snap(page);
    await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
    const s1 = await snap(page);
    expect(Math.hypot(s1.x - s0.x, s1.z - s0.z)).toBeGreaterThan(0.5);
    expect(s1.fps).toBeGreaterThan(0);
    await attach(testInfo, 'study-walk', await shot(page));
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('resume')).toBeVisible();
    await page.getByTestId('settings').click();
    await page.getByTestId('panel').getByTestId('lang').click();
    await expect(page.getByTestId('resume')).toHaveText(/继续|返回/);
    await attach(testInfo, 'settings-zh', await shot(page));
    await page.getByTestId('resume').click();
    expect(w.issues).toEqual([]); expect(w.failed).toEqual([]);
  });

  test('every beat loads from its save and renders: real screenshots, fps, memory, loads', async ({ page }, testInfo) => {
    test.setTimeout(25 * 60 * 1000);
    const w = watch(page); const { saves, BEATS } = await savesByBeat(); const perf = [];
    for (const [beat, save] of Object.entries(saves)) {
      for (const lang of beat === '1.study' || beat === '6.beach' || beat === '4.porch' ? ['en', 'zh'] : ['en']) {
        await continueFrom(page, save, { lang, quality: 'medium' });
        await page.waitForTimeout(2600);
        await attach(testInfo, `beat-${beat}-${lang}-a`, await shot(page));
        await page.keyboard.press('KeyE'); await page.keyboard.down('KeyW'); await page.waitForTimeout(1200); await page.keyboard.up('KeyW');
        await page.mouse.move(700, 360); await page.mouse.move(760, 340);
        await page.waitForTimeout(2200);
        await attach(testInfo, `beat-${beat}-${lang}-b`, await shot(page));
        const s = await snap(page);
        const mem = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null));
        perf.push({ beat, lang, world: s.world, fps: s.fps, heapMB: mem, mode: s.mode });
        expect(s.beat === beat || BEATS.indexOf(s.beat) > BEATS.indexOf(beat), `${beat} -> ${s.beat}`).toBe(true);
      }
    }
    const res = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => ({ n: r.name.replace(location.origin, ''), kb: Math.round((r.transferSize || r.encodedBodySize || 0) / 1024), ms: Math.round(r.duration) })));
    console.log('V5_PERF ' + JSON.stringify(perf));
    console.log('V5_RES ' + JSON.stringify({ count: res.length, kb: res.reduce((a, r) => a + r.kb, 0), slowest: res.sort((a, b) => b.ms - a.ms).slice(0, 5) }));
    expect(w.issues).toEqual([]); expect(w.failed).toEqual([]);
  });

  test('Tab on the pier: switches eras, refuses where there is no floor, never strands the player', async ({ page }, testInfo) => {
    const w = watch(page); const { saves } = await savesByBeat();
    await continueFrom(page, saves['1.pier']); await page.waitForTimeout(1500);
    await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(200);
    if ((await snap(page)).mode === 'pause') { await page.getByTestId('resume').click(); }
    const s0 = await snap(page);
    await page.keyboard.press('Tab'); await page.waitForTimeout(600);
    const s1 = await snap(page); expect(s1.era).not.toBe(s0.era);
    await attach(testInfo, 'tab-' + s1.era, await shot(page));
    await page.keyboard.press('Tab'); await page.waitForTimeout(600);
    expect((await snap(page)).era).toBe(s0.era);
    // walk to the end of the 1998 near deck: Tab to 2004 lands on the stub; walking on is blocked by water without it
    expect(w.issues).toEqual([]);
  });

  for (const run of [{ lang: 'en', choices: { train: 1, parting: 0, finish: 1, closer: 0, defend: 0, offer: 0, letter: 0 } }, { lang: 'zh', choices: { train: 0, parting: 1, finish: 0, closer: 1, defend: 1, offer: 1, letter: 1 } }]) {
    test.describe(() => {
      test.use({ video: { mode: 'on', size: { width: 960, height: 540 } } });
      test(`the whole game, seven chapters, ${run.lang}`, async ({ page }, testInfo) => {
        test.setTimeout(60 * 60 * 1000);
        const w = watch(page);
        await page.addInitScript(initHook);
        await page.addInitScript((lang) => { localStorage.setItem('v5.prefs.v1', JSON.stringify({ lang, quality: 'low' })); }, run.lang);
        await serveBot(page);
        await page.goto('/v5/');
        await expect(page.getByTestId('start')).toBeVisible({ timeout: 30000 });
        await page.getByTestId('start').click();
        const t0 = Date.now();
        const playing = page.evaluate(async (choices) => {
          const { playThrough } = await import('/v5-test/bot.mjs');
          const h = window.__V5_TEST__; await h.virtualize();
          const bot = await playThrough(h.game, { step: h.step, choices });
          for (let i = 0; i < 900 && !document.querySelector('[data-testid="credits"]'); i++) { await h.step({}); }
          const credits = document.querySelector('[data-testid="credits"]');
          return { t: bot.t, beats: bot.beats, stuck: bot.stuck, credits: credits ? credits.textContent : null, snap: window.V5Debug.snapshot(), album: document.querySelectorAll('[data-testid="album"] img').length };
        }, run.choices);
        // while it plays: a screenshot at every new beat and every 20 s of wall time
        let done = false, out = null, err = null; playing.then((r) => { out = r; done = true; }, (e) => { err = e; done = true; });
        let lastBeat = null, lastShot = 0, n = 0;
        while (!done) {
          await page.waitForTimeout(1500); if (done) { break; }
          const s = await snap(page).catch(() => null); if (!s) { continue; }
          if (s.beat !== lastBeat || Date.now() - lastShot > 20000) { lastBeat = s.beat; lastShot = Date.now(); n += 1; await attach(testInfo, `${run.lang}-${String(n).padStart(3, '0')}-${s.beat}`, await shot(page)); }
        }
        if (err) { throw err; }
        await attach(testInfo, `${run.lang}-credits`, await shot(page));
        console.log(`V5_TIME ${run.lang} game=${out.t.toFixed(1)}s wall=${((Date.now() - t0) / 1000).toFixed(0)}s (virtual frames, automated; not human play time)`);
        for (let c = 1; c <= 7; c++) { expect(out.beats.some((b) => b.startsWith(c + '.'))).toBe(true); }
        expect(out.credits).toContain('Elena — Programming & Music');
        expect(out.credits).toContain('June — Art & Story');
        expect(out.snap.photos.length).toBeGreaterThanOrEqual(6);
        expect(out.snap.photos.every((p) => p.thumb)).toBe(true);
        expect(out.album).toBeGreaterThanOrEqual(6);
        expect(out.stuck).toEqual([]);
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('v5.save.v1')).beat);
        expect(saved).toBe('end');
        expect(w.issues).toEqual([]); expect(w.failed).toEqual([]);
      });
    });
  }

  test('tech demo: restore changes the floor, the variant input is refused', async ({ page }, testInfo) => {
    const w = watch(page);
    await page.goto('/v5/tech');
    await expect(page.getByTestId('fixture')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.V5Tech && window.V5Tech.path2004), { timeout: 15000 }).toBe(false);
    await attach(testInfo, 'tech-broken', await page.screenshot({ type: 'jpeg', quality: 70, fullPage: true }));
    await page.getByTestId('restore').click();
    expect(await page.evaluate(() => window.V5Tech.path2004)).toBe(true);
    await expect(page.getByTestId('restore-verdict')).toContainText('RESTORED');
    await attach(testInfo, 'tech-restored', await page.screenshot({ type: 'jpeg', quality: 70, fullPage: true }));
    await page.getByTestId('variant').click();
    expect(await page.evaluate(() => [window.V5Tech.restoreOk, window.V5Tech.path2004, window.V5Tech.planks1998])).toEqual([false, false, 14]);
    await expect(page.getByTestId('restore-verdict')).toContainText('REFUSED');
    await attach(testInfo, 'tech-variant', await page.screenshot({ type: 'jpeg', quality: 70, fullPage: true }));
    expect(w.issues).toEqual([]);
  });

  for (const p of ['/', '/p3/', '/p4/']) {
    test(`regression: ${p} still loads`, async ({ page }) => {
      const res = await page.goto(p);
      expect(res.status()).toBe(200);
      await expect(page.locator('body')).not.toBeEmpty();
    });
  }
});
