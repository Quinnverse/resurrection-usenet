// V5 browser acceptance in real Chromium (WebGL through SwiftShader in CI). Run: npx playwright test e2e/v5.spec.js
//
// STATUS: written but NOT RUN. The development sandbox had no browser and V5 was not pushed, so CI never ran it.
//
// 1. Real time, real input: title, keyboard walk in the study, E at the computer, pause, settings, language.
// 2. Full game: the scripted bot from test/v5-bot.mjs runs inside the page and plays all seven chapters through the
//    real shell (main.js), DOM, CSS and WebGL. Time is virtual (one frame = 1/30 s, timers follow the same clock) so
//    the run does not depend on how fast SwiftShader draws; this is automated play, not human play time.
// 3. The tech demo: Restore makes the 2004 bridge walkable; the variant input is refused.
// 4. Regression: /, /p3/, /p4/ still load.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] }, viewport: { width: 1280, height: 720 } });

function watch(page) {
  const issues = [];
  page.on('pageerror', (e) => issues.push('page error: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) { issues.push('console: ' + m.text()); } });
  return issues;
}
const snap = (page) => page.evaluate(() => window.V5Debug.snapshot());
async function attach(testInfo, name, dataUrlOrBuf) {
  const body = Buffer.isBuffer(dataUrlOrBuf) ? dataUrlOrBuf : Buffer.from(String(dataUrlOrBuf).split(',')[1] || '', 'base64');
  await testInfo.attach(name, { body, contentType: 'image/jpeg' });
  if (process.env.CI) { console.log(`V5_SHOT ${name} ${body.toString('base64')}`); }
}

// Installed before main.js: the shell's test hook plus a switchable virtual clock.
function initHook() {
  const real = { raf: window.requestAnimationFrame.bind(window), st: window.setTimeout.bind(window), ct: window.clearTimeout.bind(window) };
  const h = { virtual: false, next: {}, last: [], now: 0, timers: [], raf: null, id: 1e6 };
  h.input = (orig) => (h.virtual ? h.next : orig);
  h.events = (evs) => { h.last = evs; };
  window.requestAnimationFrame = (cb) => { if (h.virtual) { h.raf = cb; return 1; } return real.raf(cb); };
  window.setTimeout = (fn, ms) => { if (!h.virtual) { return real.st(fn, ms); } const id = ++h.id; h.timers.push({ id, at: h.now + (ms || 0), fn }); return id; };
  window.clearTimeout = (id) => { const i = h.timers.findIndex((x) => x.id === id); if (i >= 0) { h.timers.splice(i, 1); } else { real.ct(id); } };
  h.virtualize = () => { h.virtual = true; h.now = performance.now(); };
  h.advance = () => {
    h.now += 1000 / 30;
    for (;;) { h.timers.sort((a, b) => a.at - b.at); if (!h.timers.length || h.timers[0].at > h.now) { break; } h.timers.shift().fn(); }
    const cb = h.raf; h.raf = null; if (cb) { cb(h.now); }
  };
  window.__V5_TEST__ = h;
}
// The bot module, served to the page with its imports pointed at the game's own URLs (same module instances).
async function serveBot(page) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'test', 'v5-bot.mjs'), 'utf8').split("'../frontend/v5/core/").join("'/v5/core/");
  await page.route('**/v5-test/bot.mjs', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: src }));
}

test.describe('V5 — The Summer We Never Finished', () => {
  test('title, real keyboard in the study, pause and settings', async ({ page }, testInfo) => {
    const issues = watch(page);
    await page.addInitScript(() => { localStorage.setItem('v5.prefs.v1', JSON.stringify({ lang: 'en' })); });
    await page.goto('/v5/');
    await expect(page.getByTestId('start')).toBeVisible({ timeout: 30000 });
    await attach(testInfo, 'title', await page.screenshot({ type: 'jpeg', quality: 70 }));
    await page.getByTestId('start').click();
    await expect.poll(async () => (await snap(page)).beat, { timeout: 15000 }).toBe('1.study');
    const s0 = await snap(page);
    await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
    const s1 = await snap(page);
    expect(Math.hypot(s1.x - s0.x, s1.z - s0.z)).toBeGreaterThan(0.5);
    expect(s1.fps).toBeGreaterThan(0);
    await attach(testInfo, 'study-walk', await page.screenshot({ type: 'jpeg', quality: 70 }));
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('resume')).toBeVisible();
    await page.getByTestId('settings').click();
    await page.getByTestId('lang').click();
    await expect(page.getByTestId('resume')).toHaveText(/继续|返回/);
    await attach(testInfo, 'settings-zh', await page.screenshot({ type: 'jpeg', quality: 70 }));
    await page.getByTestId('resume').click();
    expect(issues).toEqual([]);
  });

  for (const run of [{ lang: 'en', choices: { train: 1, parting: 0, finish: 1 } }, { lang: 'zh', choices: { train: 0, parting: 1, finish: 0 } }]) {
    test(`the whole game, seven chapters, ${run.lang}`, async ({ page }, testInfo) => {
      test.setTimeout(45 * 60 * 1000);
      const issues = watch(page);
      await page.addInitScript(initHook);
      await page.addInitScript((lang) => { localStorage.setItem('v5.prefs.v1', JSON.stringify({ lang, quality: 'low' })); }, run.lang);
      await serveBot(page);
      await page.goto('/v5/');
      await expect(page.getByTestId('start')).toBeVisible({ timeout: 30000 });
      await page.getByTestId('start').click();
      const out = await page.evaluate(async (choices) => {
        const { playThrough } = await import('/v5-test/bot.mjs');
        const h = window.__V5_TEST__; h.virtualize();
        const canvas = document.querySelector('canvas'); const shots = []; let beat = null, wait = 0;
        const step = (input) => {
          h.next = input || {}; h.last = []; h.advance();
          const s = window.V5Debug.snapshot();
          if (s.beat !== beat) { beat = s.beat; wait = 45; }
          if (wait && --wait === 0) { shots.push([beat, canvas.toDataURL('image/jpeg', 0.6)]); }
          return h.last;
        };
        const bot = playThrough(h.game, { step, choices });
        for (let i = 0; i < 900 && !document.querySelector('[data-testid="credits"]'); i++) { step({}); }
        const credits = document.querySelector('[data-testid="credits"]');
        return { t: bot.t, beats: bot.beats, stuck: bot.stuck, shots, credits: credits ? credits.textContent : null, snap: window.V5Debug.snapshot() };
      }, run.choices);
      for (const [beat, url] of out.shots) { await attach(testInfo, `${run.lang}-${beat}`, url); }
      await attach(testInfo, `${run.lang}-credits`, await page.screenshot({ type: 'jpeg', quality: 70 }));
      console.log(`V5_TIME ${run.lang} game=${out.t.toFixed(1)}s (virtual, automated; not human play time)`);
      for (let c = 1; c <= 7; c++) { expect(out.beats.some((b) => b.startsWith(c + '.'))).toBe(true); }
      expect(out.credits).toContain('Elena — Programming & Music');
      expect(out.credits).toContain('June — Art & Story');
      expect(out.snap.photos.length).toBeGreaterThanOrEqual(3);
      expect(out.snap.photos.every((p) => p.thumb)).toBe(true);
      expect(out.stuck).toEqual([]);
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('v5.save.v1')).beat);
      expect(saved).toBe('end');
      expect(issues).toEqual([]);
    });
  }

  test('a save continues where it was left', async ({ page }) => {
    const issues = watch(page);
    await page.addInitScript(initHook);
    await serveBot(page);
    await page.goto('/v5/');
    await expect(page.getByTestId('start')).toBeVisible({ timeout: 30000 });
    await page.getByTestId('start').click();
    await page.evaluate(async () => {
      const { makeBot } = await import('/v5-test/bot.mjs'); const h = window.__V5_TEST__; h.virtualize();
      const bot = makeBot(h.game, { step: (i) => { h.next = i || {}; h.last = []; h.advance(); return h.last; } });
      const { LAYOUTS } = await import('/v5/core/layout.js'); const c = LAYOUTS.study.points.find((q) => q.id === 'computer');
      bot.go('computer', c.x, c.z + 0.9);
      bot.use('computer'); bot.talk(); bot.until((s) => s.scene === 'town', 30); bot.wait(2);
    });
    await page.reload();
    await expect(page.getByTestId('continue')).toBeVisible({ timeout: 30000 });
    await page.getByTestId('continue').click();
    await expect.poll(async () => (await snap(page)).beat, { timeout: 15000 }).toBe('1.town');
    expect(issues).toEqual([]);
  });

  test('tech demo: restore changes the floor, the variant input is refused', async ({ page }, testInfo) => {
    const issues = watch(page);
    await page.goto('/v5/tech');
    await expect(page.getByTestId('fixture')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.V5Tech && window.V5Tech.path2004), { timeout: 15000 }).toBe(false);
    await page.getByTestId('restore').click();
    expect(await page.evaluate(() => window.V5Tech.path2004)).toBe(true);
    await expect(page.getByTestId('restore-verdict')).toContainText('RESTORED');
    await attach(testInfo, 'tech-restored', await page.screenshot({ type: 'jpeg', quality: 70, fullPage: true }));
    await page.getByTestId('variant').click();
    expect(await page.evaluate(() => [window.V5Tech.restoreOk, window.V5Tech.path2004, window.V5Tech.planks1998])).toEqual([false, false, 14]);
    await expect(page.getByTestId('restore-verdict')).toContainText('REFUSED');
    expect(issues).toEqual([]);
  });

  for (const p of ['/', '/p3/', '/p4/']) {
    test(`regression: ${p} still loads`, async ({ page }) => {
      const res = await page.goto(p);
      expect(res.status()).toBe(200);
      await expect(page.locator('body')).not.toBeEmpty();
    });
  }
});
