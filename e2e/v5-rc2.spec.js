// RC2 in real Chromium (software GPU on CI): what a first-time player sees and can do.
//  - the first minutes with keyboard and mouse: tips one at a time, the task bar, the marker on the computer, the computer
//    asking for the disk and pointing at the box, the first memory and the journal, remapped keys in every instruction
//  - the pier: the help that grows after 30, 60 and 90 s without progress (virtual clock, so it does not take minutes)
//  - the same instructions with a gamepad and on a touch screen, and in Chinese
//  - the quieter sunbeam dust and the distinct snow (screenshots for comparison with RC1)
const { test, expect } = require('@playwright/test');

test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--enable-precise-memory-info', '--autoplay-policy=no-user-gesture-required'] }, viewport: { width: 1280, height: 720 }, video: 'off' });

function watch(page) {
  const issues = [];
  page.on('pageerror', (e) => issues.push('page error: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) { issues.push('console: ' + m.text()); } });
  return { issues };
}
const snap = (page) => page.evaluate(() => window.V5Debug.snapshot());
const obj = (page) => page.evaluate(() => window.V5Debug.objective());
async function attach(testInfo, name, buf) { await testInfo.attach(name, { body: buf, contentType: 'image/jpeg' }); if (process.env.CI) { console.log(`V5_SHOT ${name} ${buf.toString('base64')}`); } }
const shot = (page) => page.screenshot({ type: 'jpeg', quality: 72 });
const prefsInit = (page, p) => page.addInitScript((pp) => { if (!sessionStorage.getItem('rc2.prefs')) { localStorage.clear(); localStorage.setItem('v5.prefs.v1', JSON.stringify(pp)); sessionStorage.setItem('rc2.prefs', '1'); } }, p);
const TIPS_DONE = { move: 1, look: 1, use: 1, goal: 1, hold: 1, tab: 1, journal: 1, pause: 1, first: 1 };
// the virtual clock from e2e/v5.spec.js, reduced: frames are stepped by the test, so 90 s of play takes as long as drawing ~2700 frames
function initHook() {
  const real = { raf: window.requestAnimationFrame.bind(window), st: window.setTimeout.bind(window), ct: window.clearTimeout.bind(window) };
  const h = { virtual: false, next: {}, last: [], now: 0, timers: [], raf: null, id: 1e6, realTimeout: real.st };
  h.input = (orig) => (h.virtual ? h.next : orig);
  h.events = (evs) => { h.last = evs; };
  window.requestAnimationFrame = (cb) => { if (h.virtual) { (h.raf = h.raf || []).push(cb); return h.raf.length; } return real.raf(cb); };
  window.setTimeout = (fn, ms) => { if (!h.virtual) { return real.st(fn, ms); } const id = ++h.id; h.timers.push({ id, at: h.now + (ms || 0), fn }); return id; };
  window.clearTimeout = (id) => { const i = h.timers.findIndex((x) => x.id === id); if (i >= 0) { h.timers.splice(i, 1); } else { real.ct(id); } };
  h.virtualize = () => new Promise((resolve) => { h.virtual = true; h.now = performance.now(); real.raf(() => real.raf(() => resolve())); });
  h.unvirtualize = () => { h.virtual = false; const cbs = h.raf || []; h.raf = null; cbs.forEach((cb) => real.raf(cb)); };
  h.step = async (input) => {
    h.next = input || {}; h.last = []; h.now += 1000 / 30;
    for (;;) { h.timers.sort((a, b) => a.at - b.at); if (!h.timers.length || h.timers[0].at > h.now) { break; } h.timers.shift().fn(); }
    const cbs = h.raf || []; h.raf = null; cbs.forEach((cb) => cb(h.now)); await new Promise((r) => real.st(r, 0)); return h.last;
  };
  window.__V5_TEST__ = h;
}
const walk = async (page, code, ms) => { await page.keyboard.down(code); await page.waitForTimeout(ms); await page.keyboard.up(code); };
// walk with real keys toward a point (turning the camera with the real mouse is slow on a software GPU, so the camera
// is turned through the game's own test view only for aiming; every movement is a real key press)
async function walkTo(page, x, z, until, maxMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < (maxMs || 25000)) {
    const s = await snap(page); if (until && (await until(s))) { return true; } if (Math.hypot(x - s.x, z - s.z) < 0.6) { return true; }
    const yaw = s.yaw; const dx = x - s.x, dz = z - s.z; const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const f = dx * fx + dz * fz, r = dx * rx + dz * rz; const keys = [];
    if (f > 0.25) { keys.push('KeyW'); } if (f < -0.25) { keys.push('KeyS'); } if (r > 0.25) { keys.push('KeyD'); } if (r < -0.25) { keys.push('KeyA'); }
    for (const k of keys) { await page.keyboard.down(k); } await page.waitForTimeout(220); for (const k of keys) { await page.keyboard.up(k); }
  }
  return false;
}

test.describe('V5 RC2 — a first-time player', () => {
  test('keyboard and mouse: tips one at a time, the task bar, the computer asks for the disk and the game points at the box, a memory, the journal, remapped keys', async ({ page }, testInfo) => {
    test.setTimeout(12 * 60 * 1000);
    const w = watch(page); await prefsInit(page, { lang: 'en', quality: 'low' });
    await page.goto('/v5/'); await expect(page.getByTestId('start')).toBeVisible({ timeout: 30000 }); await page.keyboard.press('Enter');
    await expect.poll(async () => (await snap(page)).mode, { timeout: 15000 }).toBe('play'); await page.waitForTimeout(1200);
    // 1 the first tip says how to walk, with the real keys; the task bar says the goal and the next step
    await expect(page.getByTestId('tut')).toBeVisible(); await expect(page.getByTestId('tut')).toContainText('W A S D');
    await expect(page.getByTestId('quest-goal')).toHaveText('Open Mom’s game archive'); await expect(page.getByTestId('quest-next')).toContainText('press E at the computer');
    await expect(page.getByTestId('quest-chapter')).toContainText('Chapter 1');
    expect(await page.evaluate(() => { const b = window.__V5_TEST__ && 0; void b; return !!document.querySelector('[data-testid="quest"]:not([hidden])'); })).toBe(true);
    await attach(testInfo, 'rc2-01-first-tip-and-goal', await shot(page));
    // 2 walking finishes the walking tip; the next tip is about looking around
    await walk(page, 'KeyW', 1600); await page.waitForTimeout(400);
    await expect.poll(() => page.evaluate(() => window.V5Debug.guide().tip)).toBe('look');
    await page.mouse.move(640, 360); await page.mouse.down({ button: 'right' }); for (let i = 0; i < 12; i++) { await page.mouse.move(640 + i * 30, 360); await page.waitForTimeout(40); } await page.mouse.up({ button: 'right' });
    await expect.poll(() => page.evaluate(() => window.V5Debug.guide().tip), { timeout: 10000 }).not.toBe('look');
    // 3 straight to the computer: its name appears, the tip says press E; pressing it asks for the disk
    const comp = { x: 3, z: -1.75 };
    await walkTo(page, 1.4, 0.0, null, 8000); expect(await walkTo(page, comp.x, comp.z, (s) => s.prompt && s.prompt.id === 'computer')).toBe(true);
    await expect(page.getByTestId('prompt')).toContainText('E'); await expect.poll(() => page.evaluate(() => window.V5Debug.guide().tip)).toBe('use');
    await attach(testInfo, 'rc2-02-prompt-at-computer', await shot(page));
    await page.keyboard.press('KeyE'); await page.waitForTimeout(400);
    for (let i = 0; i < 4 && (await snap(page)).dialog; i++) { await page.keyboard.press('KeyE'); await page.waitForTimeout(500); }
    let o = await obj(page); expect(o.next).toBe('disk');
    await expect(page.getByTestId('quest-next')).toContainText('KEEP'); await expect(page.getByTestId('quest-done')).toContainText('Switch on Mom’s computer');
    await attach(testInfo, 'rc2-03-computer-asks-for-disk', await shot(page));
    // pressing again gives the same answer, not something new
    await page.keyboard.press('KeyE'); await page.waitForTimeout(300); const again = (await snap(page)).dialog; expect(again && again.id).toBe('c1.noDisk');
    for (let i = 0; i < 4 && (await snap(page)).dialog; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
    if ((await snap(page)).mode !== 'play') { await page.keyboard.press('Escape'); }
    // 4 the box: open it, the first memory appears, the journal opens with J and shows it
    await walkTo(page, -0.4, 2.2, (s) => s.prompt && s.prompt.id === 'keepbox', 30000); expect(await walkTo(page, -1.1, 2.2, (s) => s.prompt && s.prompt.id === 'keepbox', 20000)).toBe(true);
    await page.keyboard.press('KeyE'); await page.waitForTimeout(300); for (let i = 0; i < 4 && (await snap(page)).dialog; i++) { await page.keyboard.press('KeyE'); await page.waitForTimeout(500); }
    await expect(page.getByTestId('mem-toast')).toBeVisible({ timeout: 8000 }); await expect(page.getByTestId('mem-toast')).toContainText('The backup disk');
    o = await obj(page); expect(o.next).toBe('load'); await expect(page.getByTestId('quest-next')).toContainText('computer');
    await attach(testInfo, 'rc2-04-first-memory', await shot(page));
    await page.keyboard.press('KeyJ'); await expect(page.getByTestId('journal-memories')).toBeVisible(); await expect(page.getByTestId('mem-disk')).toContainText('For M., when she asks');
    await expect(page.getByTestId('journal-goals')).toContainText('Find the backup disk');
    await attach(testInfo, 'rc2-05-journal', await shot(page));
    await page.keyboard.press('KeyJ'); expect((await snap(page)).mode).toBe('play');
    // 5 remap "use" to F: every instruction now says F
    await page.keyboard.press('Escape'); await page.getByTestId('settings').click(); await page.getByTestId('key-use').click(); await page.keyboard.press('KeyF'); await page.getByTestId('resume').click();
    await expect(page.getByTestId('quest-next')).toContainText('F at the computer');
    await page.getByTestId('quest-toggle').click(); await expect(page.getByTestId('quest-steps')).toBeVisible(); await expect(page.getByTestId('quest-steps')).toContainText('✓ Find the backup disk');
    await attach(testInfo, 'rc2-06-remapped-and-steps', await shot(page));
    expect(w.issues).toEqual([]);
  });

  test('the pier: no progress for 30, 60 and 90 s brings an arrow, then the next step spoken, then the place marked', async ({ page }, testInfo) => {
    test.setTimeout(15 * 60 * 1000);
    const w = watch(page); await page.addInitScript(initHook); await prefsInit(page, { lang: 'en', quality: 'low', tut: TIPS_DONE });
    await page.goto('/v5/?preview=1.pier'); await expect.poll(async () => (await snap(page).catch(() => ({}))).beat, { timeout: 60000 }).toBe('1.pier');
    await page.waitForTimeout(1500);
    // turn the camera away from the pier with a real right-button drag, so the target is off screen (the arrow is shown only then)
    await page.mouse.move(300, 360); await page.mouse.down({ button: 'right' }); for (let i = 1; i <= 24; i++) { await page.mouse.move(300 + i * 45, 360); await page.waitForTimeout(30); } await page.mouse.up({ button: 'right' }); await page.waitForTimeout(800);
    await page.evaluate(() => window.__V5_TEST__.virtualize());
    const levels = [];
    for (const until of [31, 61, 91]) {
      const r = await page.evaluate(async (u) => { const h = window.__V5_TEST__; const out = []; for (let i = 0; i < 40 * 30; i++) { const ev = await h.step({}); ev.forEach((e) => { if (e.type === 'assist' || (e.type === 'caption' && /^hint\./.test(e.key))) { out.push(e.type === 'assist' ? 'assist ' + e.level : e.key); } }); if (window.V5Debug.snapshot().stuckT >= u) { break; } } return { out, s: window.V5Debug.snapshot(), gd: window.V5Debug.guide() }; }, until);
      levels.push(r);
      await attach(testInfo, `rc2-07-pier-help-${until - 1}s`, await shot(page));
    }
    const all = levels.flatMap((r) => r.out);
    expect(all.filter((x) => x.startsWith('assist'))).toEqual(['assist 1', 'assist 2', 'assist 3']);
    expect(all.filter((x) => x.startsWith('hint.'))).toEqual(['hint.1.pier.1', 'hint.1.pier.2', 'hint.1.pier.3']);
    expect(levels[0].gd.arrow).toBe(true);   // facing away: the arrow at the edge points to the pier
    await expect(page.getByTestId('quest-help')).toContainText('H');
    await page.evaluate(() => window.__V5_TEST__.unvirtualize());
    expect(w.issues).toEqual([]);
  });

  test('a gamepad and a touch screen: the same instructions with their own buttons', async ({ browser }, testInfo) => {
    // gamepad: a simulated standard pad; the first button press switches every instruction to pad buttons
    let ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); let page = await ctx.newPage(); let w = watch(page);
    await page.addInitScript(() => { const pad = { id: 'simulated standard gamepad', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }; window.__pad = pad; navigator.getGamepads = () => [pad, null, null, null]; });
    await prefsInit(page, { lang: 'en', quality: 'low', tut: TIPS_DONE });
    await page.goto('/v5/?preview=1.pier'); await expect.poll(async () => (await snap(page).catch(() => ({}))).beat, { timeout: 60000 }).toBe('1.pier');
    await page.evaluate(() => { window.__pad.buttons[5].pressed = true; window.__pad.buttons[5].value = 1; }); await page.waitForTimeout(600); await page.evaluate(() => { window.__pad.buttons[5].pressed = false; window.__pad.buttons[5].value = 0; });
    await expect.poll(() => page.evaluate(() => window.V5Debug.guide().device)).toBe('pad');
    await expect(page.getByTestId('quest-next')).toContainText('Press Y');
    await attach(testInfo, 'rc2-08-gamepad-instructions', await shot(page));
    expect(w.issues).toEqual([]); await ctx.close();
    // touch: an emulated phone in landscape; the instruction names the on-screen button
    ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }); page = await ctx.newPage(); w = watch(page);
    await prefsInit(page, { lang: 'en', quality: 'low', tut: TIPS_DONE });
    await page.goto('/v5/?preview=1.pier'); await expect.poll(async () => (await snap(page).catch(() => ({}))).beat, { timeout: 60000 }).toBe('1.pier');
    await expect(page.getByTestId('quest-next')).toContainText('the ⇄ button');
    const era = await page.getByTestId('era').boundingBox(); for (const id of ['jump', 'use', 'tab']) { const b = await page.getByTestId('touch-' + id).boundingBox(); const hit = b && era && !(era.x + era.width <= b.x || b.x + b.width <= era.x || era.y + era.height <= b.y || b.y + b.height <= era.y); expect(hit, 'touch-' + id + ' over the year label').toBe(false); }
    const qb = await page.getByTestId('quest').boundingBox(); for (const id of ['pause', 'hint', 'journal', 'jump', 'use', 'tab']) { const b = await page.getByTestId('touch-' + id).boundingBox(); const hit = b && qb && !(qb.x + qb.width <= b.x || b.x + b.width <= qb.x || qb.y + qb.height <= b.y || b.y + b.height <= qb.y); expect(hit, 'task bar over touch-' + id).toBe(false); }
    await attach(testInfo, 'rc2-09-touch-instructions', await shot(page));
    await page.getByTestId('touch-journal').tap(); await expect(page.getByTestId('journal-memories')).toBeVisible(); await attach(testInfo, 'rc2-10-touch-journal', await shot(page));
    await page.getByTestId('journal-close').tap(); expect((await snap(page)).mode).toBe('play');
    expect(w.issues).toEqual([]); await ctx.close();
  });

  test('Chinese: the task bar, the tips and the journal in Chinese', async ({ page }, testInfo) => {
    const w = watch(page); await prefsInit(page, { lang: 'zh', quality: 'low' });
    await page.goto('/v5/'); await expect(page.getByTestId('start')).toBeVisible({ timeout: 30000 }); await page.keyboard.press('Enter');
    await expect.poll(async () => (await snap(page)).mode, { timeout: 15000 }).toBe('play'); await page.waitForTimeout(1000);
    await expect(page.getByTestId('quest-goal')).toHaveText('打开妈妈的游戏档案'); await expect(page.getByTestId('tut')).toContainText('走动');
    await attach(testInfo, 'rc2-11-chinese-first-tip', await shot(page));
    await page.goto('/v5/?preview=6.cottage&lang=zh'); await expect.poll(async () => (await snap(page).catch(() => ({}))).beat, { timeout: 60000 }).toBe('6.cottage');
    for (let i = 0; i < 20 && (await snap(page)).dialog; i++) { await page.keyboard.press('KeyE'); await page.waitForTimeout(600); }
    expect((await snap(page)).dialog).toBeFalsy();
    await expect(page.getByTestId('quest-goal')).toHaveText('帮琳收拾小屋'); await expect(page.getByTestId('quest-progress')).toHaveText('0/2');
    await page.keyboard.press('KeyJ'); await expect(page.getByTestId('journal-memories')).toContainText('记忆');
    await attach(testInfo, 'rc2-12-chinese-journal', await shot(page));
    expect(w.issues).toEqual([]);
  });

  test('the air: faint warm dust in the study sunbeam, clearly different snow at the end', async ({ page }, testInfo) => {
    const w = watch(page); await prefsInit(page, { lang: 'en', quality: 'medium', tut: TIPS_DONE });
    await page.goto('/v5/?preview=1.study'); await expect.poll(async () => (await snap(page).catch(() => ({}))).beat, { timeout: 60000 }).toBe('1.study'); await page.waitForTimeout(2500);
    await attach(testInfo, 'rc2-13-study-dust-after', await shot(page));
    await page.goto('/v5/?preview=snow'); await expect.poll(async () => (await snap(page).catch(() => ({}))).beat, { timeout: 60000 }).toBe('7.town'); await page.waitForTimeout(3000);
    await attach(testInfo, 'rc2-14-snow-after', await shot(page));
    expect(w.issues).toEqual([]);
  });
});
