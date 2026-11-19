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

test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--enable-precise-memory-info', '--autoplay-policy=no-user-gesture-required'] }, viewport: { width: 1280, height: 720 }, video: { mode: 'on', size: { width: 960, height: 540 } } });

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
  // devices: the game reads its own input (keyboard, mouse, touch, pad) and the hook only counts frames
  h.input = (orig) => (h.virtual && !h.devices ? h.next : orig);
  h.events = (evs) => { h.last = evs; };
  // every callback is kept (the game's loop and anyone else's, e.g. a rAF-polling wait), and each runs once per frame
  window.requestAnimationFrame = (cb) => { if (h.virtual) { (h.raf = h.raf || []).push(cb); return h.raf.length; } return real.raf(cb); };
  window.setTimeout = (fn, ms) => { if (!h.virtual) { return real.st(fn, ms); } const id = ++h.id; h.timers.push({ id, at: h.now + (ms || 0), fn }); return id; };
  window.clearTimeout = (id) => { const i = h.timers.findIndex((x) => x.id === id); if (i >= 0) { h.timers.splice(i, 1); } else { real.ct(id); } };
  // switch to virtual frames; wait for the game's pending real frame so its loop re-registers on the virtual clock
  h.virtualize = () => new Promise((resolve) => { h.virtual = true; h.now = performance.now(); real.raf(() => real.raf(() => resolve())); });
  h.advance = () => {
    h.now += 1000 / 30;
    for (;;) { h.timers.sort((a, b) => a.at - b.at); if (!h.timers.length || h.timers[0].at > h.now) { break; } h.timers.shift().fn(); }
    const cbs = h.raf || []; h.raf = null; for (const cb of cbs) { cb(h.now); }
  };
  // one virtual frame, then give the browser a moment to paint (and the test runner a chance to take screenshots)
  h.unvirtualize = () => { h.virtual = false; h.devices = false; const cbs = h.raf || []; h.raf = null; for (const cb of cbs) { real.raf(cb); } };
  h.frame = async () => { h.last = []; h.advance(); await new Promise((r) => real.st(r, 0)); return h.last; };
  h.step = async (input) => { h.next = input || {}; h.last = []; h.advance(); await new Promise((r) => real.st(r, 0)); return h.last; };
  window.__V5_TEST__ = h;
}
// The bot module, served to the page with its imports pointed at the game's own URLs (same module instances).
// A standard-mapping gamepad object (a simulation in the page, not hardware).
function installPad() {
  const pad = { id: 'simulated standard gamepad', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  window.__pad = pad; navigator.getGamepads = () => [pad, null, null, null];
  window.__press = (i, on) => { pad.buttons[i].pressed = on; pad.buttons[i].value = on ? 1 : 0; pad.timestamp += 1; };
}
const padTap = async (page, i) => { await page.evaluate((b) => window.__press(b, true), i); await page.waitForTimeout(700); await page.evaluate((b) => window.__press(b, false), i); await page.waitForTimeout(500); };
async function serveBot(page) {
  const dev = fs.readFileSync(path.join(__dirname, '..', 'test', 'v5-devices.mjs'), 'utf8');
  await page.route('**/v5-test/devices.mjs', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: dev }));
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

// Lines of dialogue where the camera and the acting carry the chapter (2, 4, 5, 6, 7). A screenshot is taken on each.
const KEY_LINES = ['c2.june.youreTheView', 'c2.june.sketchDone', 'c2.june.coldHand', 'c2.june.wokeShot', 'c2.june.woke',
  'c4.june.portfolio', 'c4.june.notForYou', 'c4.june.boatDone', 'c4.june.scoot', 'c4.june.keep', 'c4.june.window', 'c4.june.poem', 'c4.elena.almost', 'c4.june.know',
  'c5.june.chose', 'c5.june.dontStay', 'c5.elena.stayed',
  'c6.june.remember', 'c6.june.answered', 'c6.june.admitted', 'c6.june.letterSay', 'c6.june.iKnow', 'c6.june.kept', 'c6.june.notToday', 'c6.june.careful',
  'c7.mara.unsent', 'c7.mara.read98', 'c7.iris.thanks', 'c7.mara.summerEnd', 'c7.theo.end', 'c7.theo.goodnight'];

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
    await page.keyboard.down('KeyW'); await page.waitForTimeout(3000); await page.keyboard.up('KeyW');
    const s1 = await snap(page);
    expect(Math.hypot(s1.x - s0.x, s1.z - s0.z)).toBeGreaterThan(0.3);
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
        const fr = await page.evaluate(() => (window.V5Perf ? window.V5Perf() : null));
        perf.push({ beat, lang, world: s.world, fps: s.fps, avgMs: fr ? +fr.avgMs.toFixed(1) : null, p95Ms: fr ? +fr.p95Ms.toFixed(1) : null, worstMs: fr ? Math.round(fr.worstMs) : null, gpu: fr ? fr.gpu : null, heapMB: mem, mode: s.mode, audio: s.audio ? { state: s.audio.state, rms: +s.audio.rms.toFixed(4) } : null, theme: (s.heard || []).filter((h) => h.startsWith('theme:')).slice(-1)[0] });
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
      test(`the whole game, seven chapters, ${run.lang}`, async ({ page }, testInfo) => {
        test.setTimeout(60 * 60 * 1000);
        const w = watch(page);
        await page.addInitScript(initHook);
        await page.addInitScript((lang) => { localStorage.setItem('v5.prefs.v1', JSON.stringify({ lang, quality: 'low' })); }, run.lang);
        await serveBot(page);
        const playtest = run.lang === 'zh';   // the ZH run also exercises the playtest recorder (bot, not a person)
        await page.goto(playtest ? '/v5/?playtest=1' : '/v5/');
        await expect(page.getByTestId('start')).toBeVisible({ timeout: 30000 });
        if (playtest) { await page.getByTestId('pt-tester').fill('ci-bot'); }
        await page.getByTestId('start').click();
        const t0 = Date.now();
        const playing = page.evaluate(async ([choices, keys]) => {
          const { playThrough } = await import('/v5-test/bot.mjs');
          const h = window.__V5_TEST__; await h.virtualize();
          const want = new Set(keys); let pend = null;
          // a screenshot request on key lines of dialogue (taken by the test runner, with the HUD), and the playtest rating cards
          const step = async (input) => {
            const rate = document.querySelector('[data-testid="rate-done"]');
            if (rate && !document.querySelector('[data-testid="panel"]').hidden) { document.querySelector('[data-testid="rate-fun-4"]').click(); document.querySelector('[data-testid="rate-moved-3"]').click(); rate.click(); }
            const ev = await h.step(input); const s = window.V5Debug.snapshot();
            const k = s.dialog && Array.isArray(s.dialog.line) ? s.dialog.line[1] : null;
            if (k && want.has(k) && !pend) { pend = { k, n: 0 }; want.delete(k); }
            if (pend && ++pend.n === 8) { h.shotReq = pend.k; while (h.shotReq) { await new Promise((r) => h.realTimeout(r, 40)); } pend = null; }
            return ev;
          };
          const bot = await playThrough(h.game, { step, choices });
          for (let i = 0; i < 900 && !document.querySelector('[data-testid="credits"]'); i++) { await step({}); }
          const credits = document.querySelector('[data-testid="credits"]');
          return { t: bot.t, beats: bot.beats, stuck: bot.stuck, credits: credits ? credits.textContent : null, snap: window.V5Debug.snapshot(), album: document.querySelectorAll('[data-testid="album"] img').length };
        }, [run.choices, KEY_LINES]);
        // while it plays: a screenshot at every new beat and every 20 s of wall time
        let done = false, out = null, err = null; playing.then((r) => { out = r; done = true; }, (e) => { err = e; done = true; });
        let lastBeat = null, lastShot = 0, n = 0;
        while (!done) {
          await page.waitForTimeout(200); if (done) { break; }
          const req = await page.evaluate(() => window.__V5_TEST__.shotReq || null).catch(() => null);
          if (req) { await page.waitForTimeout(350); await page.waitForFunction(() => { const el = document.querySelector('.subs'); return !el || !el.classList.contains('on') || parseFloat(getComputedStyle(el).opacity) > 0.98; }, null, { timeout: 3000, polling: 50 /* not 'raf': the virtual clock keeps one rAF callback, the game's */ }).catch(() => {}); await attach(testInfo, `scene-${run.lang}-${req}`, await shot(page)); await page.evaluate(() => { window.__V5_TEST__.shotReq = null; }); continue; }
          if (Date.now() - lastShot < 1500) { continue; }
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
        console.log('V5_PHOTOS ' + run.lang + ' ' + JSON.stringify(out.snap.photos));
        expect(out.snap.photos.every((p) => p.thumb)).toBe(true);
        expect(out.album).toBeGreaterThanOrEqual(6);
        expect(out.stuck).toEqual([]);
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('v5.save.v1')).beat);
        expect(saved).toBe('end');
        if (playtest) {
          const pt = await page.evaluate(() => JSON.parse(localStorage.getItem('v5.playtest.v1')));
          console.log('V5_PLAYTEST_JSON ' + JSON.stringify(pt));
          await testInfo.attach('playtest-log-bot-sample.json', { body: JSON.stringify(pt, null, 2), contentType: 'application/json' });
          console.log('V5_PLAYTEST_SAMPLE ' + JSON.stringify({ tester: pt.tester, finished: pt.finished, chapters: Object.fromEntries(Object.entries(pt.chapters).map(([k, v]) => [k, Math.round(v.ms / 1000)])), ratings: Object.keys(pt.ratings), inputs: pt.inputs, gpu: pt.device && pt.device.gpu }));
          expect(pt.tester).toBe('ci-bot'); expect(pt.finished).toBe(true);
          for (let c = 1; c <= 7; c++) { expect(pt.chapters[c] && pt.chapters[c].ms > 0, 'chapter ' + c).toBe(true); expect(pt.ratings[c], 'rating ' + c).toBeTruthy(); }
          await expect(page.getByTestId('pt-download-end')).toBeVisible();
        }
        expect(w.issues).toEqual([]); expect(w.failed).toEqual([]);
      });
    });
  }

  // ---- controls beyond keyboard and mouse ----------------------------------------------------------------------
  test('key remapping: a rebound key moves, the old one does not, reset restores it', async ({ page }) => {
    const w = watch(page); const { saves } = await savesByBeat();
    await continueFrom(page, saves['1.town']); await page.waitForTimeout(1500);
    const walk = async (code) => { const a = await snap(page); await page.keyboard.down(code); await page.waitForTimeout(1500); await page.keyboard.up(code); await page.waitForTimeout(300); const b = await snap(page); return Math.hypot(b.x - a.x, b.z - a.z); };
    await page.keyboard.press('Escape'); await page.getByTestId('settings').click();
    await page.getByTestId('key-forward').click(); await page.keyboard.press('KeyI');
    await expect(page.getByTestId('key-forward')).toContainText('I');
    await page.getByTestId('resume').click(); await page.waitForTimeout(300);
    const byI = await walk('KeyI'), byW = await walk('KeyW');
    console.log('V5_REMAP ' + JSON.stringify({ byI, byW }));
    expect(byI).toBeGreaterThan(0.3); expect(byW).toBeLessThan(0.1);
    await page.keyboard.press('Escape'); await page.getByTestId('settings').click(); await page.getByTestId('reset-keys').click(); await page.getByTestId('resume').click();
    expect(await walk('KeyW')).toBeGreaterThan(0.3);
    expect(w.issues).toEqual([]);
  });

  test('touch (emulated in Chromium): stick moves, buttons jump and hold to restore, pause', async ({ browser }, testInfo) => {
    const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 720 } }); const page = await ctx.newPage(); const w = watch(page);
    const { saves } = await savesByBeat(); const sv = JSON.parse(JSON.stringify(saves['1.town']));
    sv.seen.push('c1.theo1'); sv.pos = { town: { x: 0, y: 0, z: 6.9, yaw: Math.PI } };
    await continueFrom(page, sv); await page.waitForTimeout(1500);
    const cdp = await ctx.newCDPSession(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
    // stick on the left half, toward the camera's forward: drag up and hold
    const a = await snap(page);
    await touch('touchStart', [[300, 520]]); for (let i = 1; i <= 8; i++) { await touch('touchMove', [[300, 520 - i * 10]]); await page.waitForTimeout(40); } await page.waitForTimeout(900); await touch('touchEnd', []);
    await page.waitForTimeout(300); const b = await snap(page);
    await expect(page.getByTestId('touchui')).toBeVisible();
    const moved = Math.hypot(b.x - a.x, b.z - a.z);
    // the jump button
    const jb = await page.getByTestId('touch-jump').boundingBox(); await touch('touchStart', [[jb.x + jb.width / 2, jb.y + jb.height / 2]]); await page.waitForTimeout(120); await touch('touchEnd', []);
    await page.waitForTimeout(250); const jumped = (await snap(page)).log.includes('body');
    await attach(testInfo, 'touch-ui', await shot(page));
    // hold the interact button at the gap to restore the bridge
    let s = await snap(page);
    // the hold takes 4 s of game time; on a software GPU at a few fps that is longer in real time, so hold until done (max 40 s)
    const ub = await page.getByTestId('touch-use').boundingBox(); await touch('touchStart', [[ub.x + ub.width / 2, ub.y + ub.height / 2]]);
    const holdT0 = Date.now(); while (Date.now() - holdT0 < 40000 && (await snap(page)).bridge < 0.99) { await page.waitForTimeout(300); }
    const holdSecs = (Date.now() - holdT0) / 1000; await touch('touchEnd', []);
    s = await snap(page);
    const pb = await page.getByTestId('touch-pause').boundingBox(); await touch('touchStart', [[pb.x + pb.width / 2, pb.y + pb.height / 2]]); await touch('touchEnd', []); await page.waitForTimeout(300);
    const paused = (await snap(page)).mode;
    console.log('V5_TOUCH ' + JSON.stringify({ moved, jumped, holdSecs, fps: s.fps, bridge: s.bridge, restored: s.restored, prompt: s.prompt && s.prompt.id, paused }));
    expect(moved).toBeGreaterThan(0.2); expect(jumped).toBe(true); expect(s.bridge).toBeGreaterThan(0.9); expect(paused).toBe('pause');
    expect(w.issues).toEqual([]); await ctx.close();
  });

  // ---- each input device on its own: menus, pause and resume, save and continue ----------------------------------
  test('gamepad only: title, new-game confirm, pause, settings, resume, save and continue', async ({ page }, testInfo) => {
    const w = watch(page); await page.addInitScript(installPad);
    await page.addInitScript(() => { localStorage.setItem('v5.prefs.v1', JSON.stringify({ lang: 'en', quality: 'low' })); });
    await page.goto('/v5/'); await expect(page.getByTestId('start')).toBeVisible({ timeout: 30000 });
    await padTap(page, 0);                                                                  // A: Start
    await expect.poll(async () => (await snap(page)).mode, { timeout: 15000 }).toBe('play');
    const a = await snap(page); await page.evaluate(() => { window.__pad.axes[1] = -1; }); await page.waitForTimeout(2000); await page.evaluate(() => { window.__pad.axes[1] = 0; }); await page.waitForTimeout(300);
    const b = await snap(page); expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(0.3);
    await padTap(page, 9); expect((await snap(page)).mode).toBe('pause');                 // Start: pause
    await padTap(page, 13); await padTap(page, 0);                                          // D-pad down to Settings, A
    await expect(page.getByTestId('sound')).toBeVisible();
    const subsBtn = page.getByTestId('panel').getByTestId('subs'); const subs0 = await subsBtn.textContent();
    for (let k = 0; k < 12 && !(await page.evaluate(() => document.activeElement && document.activeElement.dataset.testid === 'subs')); k++) { await padTap(page, 13); }
    await padTap(page, 0); expect(await subsBtn.textContent()).not.toBe(subs0);   // A toggled subtitle size
    await attach(testInfo, 'pad-settings', await shot(page));
    await padTap(page, 1); expect((await snap(page)).mode).toBe('play');                   // B: back to the game
    await padTap(page, 9); await padTap(page, 9); expect((await snap(page)).mode).toBe('play');   // Start twice: pause, resume
    const beat = (await snap(page)).beat; await page.waitForTimeout(6000);                 // autosave runs every 5 s
    await page.reload(); await expect(page.getByTestId('continue')).toBeVisible({ timeout: 30000 });
    await padTap(page, 13); await padTap(page, 0);                                          // D-pad to New game, A: asks first
    await expect(page.getByTestId('confirm')).toBeVisible(); await attach(testInfo, 'pad-confirm', await shot(page));
    await padTap(page, 0); await expect(page.getByTestId('confirm')).toBeHidden();         // A on Cancel (focused)
    await padTap(page, 12); await padTap(page, 0);                                          // back up to Continue, A
    await expect.poll(async () => (await snap(page)).mode, { timeout: 15000 }).toBe('play');
    expect((await snap(page)).beat).toBe(beat);
    console.log('V5_PAD_MENUS ok ' + beat);
    expect(w.issues).toEqual([]);
  });

  test('keyboard only: title with Enter, arrows in menus, Esc pause and resume, choices with number keys', async ({ page }, testInfo) => {
    const w = watch(page); const { saves } = await savesByBeat();
    await page.addInitScript(() => { localStorage.setItem('v5.prefs.v1', JSON.stringify({ lang: 'en', quality: 'low' })); });
    await page.goto('/v5/'); await expect(page.getByTestId('start')).toBeVisible({ timeout: 30000 });
    await page.keyboard.press('Enter'); await expect.poll(async () => (await snap(page)).mode, { timeout: 15000 }).toBe('play');
    await page.keyboard.press('Escape'); expect((await snap(page)).mode).toBe('pause');
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');   // Resume is focused; down to Settings
    await expect(page.getByTestId('sound')).toBeVisible();
    await page.keyboard.press('Escape'); expect((await snap(page)).mode).toBe('play');
    // a dialogue choice with the number keys (chapter 5, the parting words)
    const sv = JSON.parse(JSON.stringify(saves['5.depart'])); Object.assign(sv.flags, { c5arrive: true, suitcase: true, walked: true }); sv.pos = { station: { x: -26.3, z: -0.5, y: 0, yaw: -Math.PI / 2 } };
    await continueFrom(page, sv); await page.waitForTimeout(1500);
    const s0 = await snap(page); expect(s0.prompt && s0.prompt.id).toBe('june');
    await page.keyboard.press('KeyE');
    for (let k = 0; k < 40 && !(await snap(page)).dialog?.line?.choice; k++) { await page.keyboard.press('KeyE'); await page.waitForTimeout(350); }
    await attach(testInfo, 'kbd-choice', await shot(page));
    await page.keyboard.press('Digit2'); await page.waitForTimeout(500);
    expect((await snap(page)).choices.parting).toBe('c5.choice.miss');
    expect(w.issues).toEqual([]);
  });

  // ---- the whole game with ONE device, no injected game input ----------------------------------------------------
  for (const dev of ['kbm', 'pad', 'touch']) {
    test(`the whole game with only ${dev === 'kbm' ? 'keyboard and mouse' : dev === 'pad' ? 'a gamepad' : 'touch'} (device: ${dev})`, async ({ browser }, testInfo) => {
      test.setTimeout(85 * 60 * 1000);
      const ctx = await browser.newContext(dev === 'touch' ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, recordVideo: { dir: testInfo.outputPath('video'), size: { width: 844, height: 390 } } } : { viewport: { width: 960, height: 540 }, recordVideo: { dir: testInfo.outputPath('video'), size: { width: 960, height: 540 } } });
      const page = await ctx.newPage(); const w = watch(page); const lang = dev === 'pad' ? 'zh' : 'en';
      if (dev === 'pad') { await page.addInitScript(installPad); }
      await page.addInitScript(initHook);
      await page.addInitScript((l) => { localStorage.setItem('v5.prefs.v1', JSON.stringify({ lang: l, quality: 'low' })); }, lang);
      await serveBot(page);
      await page.goto('/v5/'); await expect(page.getByTestId('start')).toBeVisible({ timeout: 30000 });
      // start the game with the device itself, in real time
      if (dev === 'pad') { await padTap(page, 0); } else if (dev === 'kbm') { await page.keyboard.press('Enter'); } else { await page.getByTestId('start').tap(); }
      await expect.poll(async () => (await snap(page)).mode, { timeout: 15000 }).toBe('play');
      // pause and resume with the device, in real time
      if (dev === 'pad') { await padTap(page, 9); expect((await snap(page)).mode).toBe('pause'); await padTap(page, 1); }
      else if (dev === 'kbm') { await page.keyboard.press('Escape'); expect((await snap(page)).mode).toBe('pause'); await page.keyboard.press('Escape'); }
      else {
        try { await expect(page.getByTestId('touch-pause')).toBeVisible({ timeout: 15000 }); await page.getByTestId('touch-pause').tap({ timeout: 15000 }); expect((await snap(page)).mode).toBe('pause'); await page.getByTestId('resume').tap({ timeout: 15000 }); }
        catch (e) { await attach(testInfo, 'touch-pause-failure', await shot(page)); throw e; }
      }
      expect((await snap(page)).mode).toBe('play');
      const t0 = Date.now();
      const playing = page.evaluate(async ([d, choices]) => {
        const { playThrough } = await import('/v5-test/bot.mjs'); const D = await import('/v5-test/devices.mjs');
        const h = window.__V5_TEST__; await h.virtualize(); h.devices = true;
        const step = D.DRIVERS[d](h);
        const bot = await playThrough(h.game, { step, choices });
        for (let i = 0; i < 900 && !document.querySelector('[data-testid="credits"]'); i++) { await h.frame(); }
        const credits = document.querySelector('[data-testid="credits"]'); const snapEnd = window.V5Debug.snapshot();
        h.unvirtualize();   // back to real time: the credits are left with the device, as a player would
        return { t: bot.t, beats: bot.beats, stuck: bot.stuck, credits: credits ? credits.textContent : null, snap: snapEnd };
      }, [dev, dev === 'pad' ? { train: 0, parting: 1, finish: 0, closer: 1, defend: 1, offer: 1, letter: 1 } : { train: 1, parting: 0, finish: 1, closer: 0, defend: 0, offer: 0, letter: 0 }]);
      let done = false, out = null, err = null; playing.then((r) => { out = r; done = true; }, (e) => { err = e; done = true; });
      let lastBeat = null, n = 0;
      while (!done) { await page.waitForTimeout(2000); if (done) { break; } const s = await snap(page).catch(() => null); if (s && s.beat !== lastBeat) { lastBeat = s.beat; n += 1; await attach(testInfo, `${dev}-${String(n).padStart(2, '0')}-${s.beat}`, await shot(page)); } }
      if (err) { await attach(testInfo, `${dev}-failure`, await shot(page)); await ctx.close(); throw err; }
      await attach(testInfo, `${dev}-credits`, await shot(page));
      // leave the credits with the device too
      if (dev === 'pad') { await page.evaluate(() => { window.__pad.buttons.forEach((b) => { b.pressed = false; b.value = 0; }); window.__pad.axes.fill(0); }); await page.waitForTimeout(400); await padTap(page, 0); } else if (dev === 'kbm') { await page.keyboard.press('Enter'); } else { await page.getByTestId('keep-exploring').tap(); }
      await page.waitForTimeout(800); const after = await snap(page);
      console.log(`V5_DEVICE ${dev} ok game=${out.t.toFixed(0)}s wall=${((Date.now() - t0) / 1000).toFixed(0)}s inputs=${JSON.stringify(out.snap.log.slice(-3))} afterCredits=${after.mode}`);
      for (let c = 1; c <= 7; c++) { expect(out.beats.some((x) => x.startsWith(c + '.')), 'chapter ' + c).toBe(true); }
      expect(out.credits).toContain('June — Art & Story');
      expect(out.stuck).toEqual([]);
      expect(after.mode).toBe('play');
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('v5.save.v1')).beat)).toBe('end');
      expect(w.issues).toEqual([]); expect(w.failed).toEqual([]);
      await ctx.close();
    });
  }

  // ---- audio: every arrangement and effect produces sound without clipping (signal only, nobody is listening) ----
  test('audio page: every theme and effect plays, measured output level, no clipping', async ({ page }, testInfo) => {
    test.setTimeout(10 * 60 * 1000);
    const w = watch(page);
    await page.goto('/v5/audio'); await page.waitForFunction(() => window.V5AudioReady, null, { timeout: 30000 });
    await page.getByTestId('play-fx-blip').click();   // a user gesture for the audio context
    const out = await page.evaluate(async () => {
      const r = { themes: {}, effects: {} };
      for (const t of window.V5Audio.themes()) { r.themes[t] = await window.V5Audio.theme(t, 3); }
      for (const f of window.V5Audio.effects()) { r.effects[f] = await window.V5Audio.effect(f); }
      return r;
    });
    await attach(testInfo, 'audio-page', await page.screenshot({ type: 'jpeg', quality: 70, fullPage: true }));
    const round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { rms: +v.rms.toFixed(4), peak: +v.peak.toFixed(3), state: v.state }]));
    console.log('V5_AUDIO ' + JSON.stringify({ themes: round(out.themes), effects: round(out.effects) }));
    for (const [k, v] of Object.entries(out.themes)) { expect(v.state, k).toBe('running'); expect(v.rms, 'theme ' + k + ' silent').toBeGreaterThan(0.0005); expect(v.peak, 'theme ' + k + ' clips').toBeLessThan(0.99); }
    for (const [k, v] of Object.entries(out.effects)) { expect(v.peak, 'effect ' + k + ' silent').toBeGreaterThan(0.001); expect(v.peak, 'effect ' + k + ' clips').toBeLessThan(0.99); }
    expect(w.issues).toEqual([]);
  });

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
