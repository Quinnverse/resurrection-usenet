// P3.2 browser acceptance (Playwright, real Chromium). Run with `npm run test:e2e`.
//
// The player is driven only through real input: keyboard events, or touch-pad pointer events on the phone run.
// The scripted player may READ the read-only window.P3Debug.snapshot() to time its keys (like a person watching
// the screen), but it never changes game state. Wall-clock times are measured and printed as P3_TIME lines. They
// are AUTOMATED times, not human play time. Screenshots are attached and, in CI, printed to the job log as JPEG.

const { test, expect, devices } = require('@playwright/test');

const PATH = '/p3/';
const SOLUTION = { s1: 'a-left', s2: 'l-mid', s3: 'a-right' };

// ---- helpers --------------------------------------------------------------------------------------

function watch(page, issues) {
  page.on('pageerror', (e) => issues.push('page error: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) { issues.push('console error: ' + m.text()); } });
}
const snap = (page) => page.evaluate(() => window.P3Debug.snapshot());
const until = (page, fn, arg, timeout) => page.waitForFunction(fn, arg, { polling: 'raf', timeout: timeout || 30000 });
const tr = (page, lang, key, vars) => page.evaluate(([l, k, v]) => window.P3I18n.t(l, k, v), [lang, key, vars || null]);

async function shot(page, testInfo, name, canvasOnly) {
  const buf = await (canvasOnly ? page.getByTestId('view') : page).screenshot({ type: 'jpeg', quality: 62 });
  await testInfo.attach(name, { body: buf, contentType: 'image/jpeg' });
  if (process.env.CI) { console.log(`P3_SHOT ${testInfo.project.name} ${name} ${buf.toString('base64')}`); }
}

// Counts distinct colours and colour changes in the live canvas, so a flat placeholder block would fail.
async function richness(page, testId) {
  return page.evaluate((id) => {
    const cv = document.querySelector('[data-testid="' + id + '"]');
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    const seen = new Set(); let changes = 0;
    for (let i = 0; i < d.length; i += 4) { seen.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); if (i > 4 && d[i] !== d[i - 4]) { changes++; } }
    return { colours: seen.size, changes };
  }, testId || 'view');
}

function controls(page, mode) {
  const pad = (id) => page.getByTestId(id);
  if (mode === 'touch') {
    return {
      hold: (dir) => pad(dir > 0 ? 'pad-right' : 'pad-left').dispatchEvent('pointerdown'),
      release: (dir) => pad(dir > 0 ? 'pad-right' : 'pad-left').dispatchEvent('pointerup'),
      jump: () => pad('pad-jump').dispatchEvent('pointerdown'),
      use: () => pad('pad-use').dispatchEvent('pointerdown'),
      tap: (id) => page.getByTestId(id).tap()
    };
  }
  return {
    hold: (dir) => page.keyboard.down(dir > 0 ? 'ArrowRight' : 'ArrowLeft'),
    release: (dir) => page.keyboard.up(dir > 0 ? 'ArrowRight' : 'ArrowLeft'),
    jump: async () => { await page.keyboard.down('Space'); await page.keyboard.up('Space'); },
    use: () => page.keyboard.press('e'),
    tap: (id) => page.getByTestId(id).click()
  };
}

async function walkTo(page, c, x, tol) {
  const t = tol || 0.3, s = await snap(page);
  if (Math.abs(s.x - x) < t) { return; }
  const dir = x > s.x ? 1 : -1;
  await c.hold(dir);
  await until(page, ([tx, d]) => { const q = window.P3Debug.snapshot(); return d > 0 ? q.x >= tx : q.x <= tx; }, [x, dir]);
  await c.release(dir);
  await page.waitForTimeout(120);
}
async function interact(page, c, id) {
  await until(page, (want) => window.P3Debug.snapshot().near === want, id, 15000);
  await c.use();
  await page.waitForTimeout(160);
}
// Runs right, jumps at jx, keeps running until it lands (on row landY, or beyond x landX).
async function jumpAt(page, c, jx, landY, landX) {
  await c.hold(1);
  await until(page, (x) => { const s = window.P3Debug.snapshot(); return s.onGround && s.x >= x; }, jx);
  await c.jump();
  await until(page, () => !window.P3Debug.snapshot().onGround);
  await until(page, ([ly, lx]) => { const s = window.P3Debug.snapshot(); return s.onGround && (ly == null || Math.abs(s.y - ly) < 0.1) && (lx == null || s.x >= lx); }, [landY == null ? null : landY, landX == null ? null : landX]);
  await c.release(1);
  await page.waitForTimeout(100);
}
async function stepOffRight(page, c, edgeX) {          // walk off a platform and drop straight down
  await c.hold(1);
  await until(page, (x) => window.P3Debug.snapshot().x > x, edgeX);
  await c.release(1);
  await until(page, () => { const q = window.P3Debug.snapshot(); return q.onGround && q.y > 9.9; });
}
async function sceneIs(page, name) { await until(page, (n) => { const s = window.P3Debug.snapshot(); return s.scene === n && !s.trans; }, name, 20000); await page.waitForTimeout(150); }
async function captionIs(page, key) { await until(page, (k) => window.P3Debug.snapshot().caption === k, key, 8000); }
async function feedback(page, id) { return (await page.getByTestId(id || 'feedback').innerText()).trim(); }

async function newGameTo(page, lang) {
  await page.addInitScript((l) => { if (!localStorage.getItem('p3.lang.v1')) { localStorage.setItem('p3.lang.v1', l); } }, lang);
  await page.goto(PATH);
  await page.waitForFunction(() => window.P3Debug);
}

// One complete playthrough, from the title screen to the explored island.
async function playAll(page, testInfo, o) {
  const c = controls(page, o.mode), lang = o.lang, T = (k, v) => tr(page, lang, k, v);
  const t0 = Date.now(), marks = {};
  const mark = (n) => { marks[n] = (Date.now() - t0) / 1000; };
  await newGameTo(page, lang);
  await expect(page.getByTestId('start')).toHaveText(await T('ui.start'));
  await shot(page, testInfo, o.name + '-01-title');
  await page.getByTestId('start').click();

  // A. the study: first interaction well inside 30 s
  await expect(page.getByTestId('hud-zone')).toHaveText(await T('zone.study'));
  await expect(page.getByTestId('caption')).toContainText(await T('say.intro'));
  await shot(page, testInfo, o.name + '-02-study');
  await walkTo(page, c, 3.4); await interact(page, c, 'shelf');
  await expect(page.getByTestId('caption')).toContainText(await T('say.shelf'));
  mark('first-interaction');
  await walkTo(page, c, 5.4); await interact(page, c, 'tape');
  await expect(page.getByTestId('caption')).toContainText(await T('say.tape'));
  await walkTo(page, c, 7.4); await interact(page, c, 'photo');
  await walkTo(page, c, 13.1); await interact(page, c, 'notes');
  await walkTo(page, c, 14.6);
  const rs = await richness(page); expect(rs.colours, 'study colours').toBeGreaterThan(70); expect(rs.changes, 'study detail').toBeGreaterThan(3000);
  await shot(page, testInfo, o.name + '-03-study-monitor');
  await interact(page, c, 'monitor');
  await sceneIs(page, 'world'); mark('core-gameplay');

  // B. the summer meadow
  await expect(page.getByTestId('hud-zone')).toHaveText(await T('zone.B'));
  await walkTo(page, c, 4.6); await interact(page, c, 'sign0');
  await expect(page.getByTestId('caption')).toContainText(await T('say.sign0'));
  await shot(page, testInfo, o.name + '-04-meadow');
  await walkTo(page, c, 10.4); await interact(page, c, 'cat');
  await walkTo(page, c, 15.0);
  await jumpAt(page, c, 16.0, null, 21);                       // over the stream
  if (o.hidden) {
    await walkTo(page, c, 20.6);
    for (const [jx, ly] of [[21.2, 8], [25.1, 6], [29.1, 4], [33.1, 2]]) { await jumpAt(page, c, jx, ly); }
    await walkTo(page, c, 40.5); await interact(page, c, 'garden');
    expect((await snap(page)).flags.garden).toBe(true);
    await shot(page, testInfo, o.name + '-05-secret-garden');
    await stepOffRight(page, c, 44.35);
  }
  await walkTo(page, c, 44.0);
  await jumpAt(page, c, 45.0, null, 49.5);                     // over the second gap
  await walkTo(page, c, 55.6); await interact(page, c, 'sign3');

  // C. the broken bridge
  await expect(page.getByTestId('hud-zone')).toHaveText(await T('zone.C'));
  await walkTo(page, c, 58.7); await interact(page, c, 'blueprint');
  await walkTo(page, c, 60.7); await interact(page, c, 'bridge');
  await captionIs(page, 'say.bridgeNone');                     // nothing to place yet: the game points to the servers
  await shot(page, testInfo, o.name + '-06-broken-bridge');
  const gotLedge = async () => { await c.hold(1); await until(page, () => { const s = window.P3Debug.snapshot(); return s.onGround && s.y > 11.9; }); await c.release(1); await page.waitForTimeout(100); };
  await gotLedge();
  await shot(page, testInfo, o.name + '-07-server-ledge');
  await interact(page, c, 'door');
  await sceneIs(page, 'server');

  // D. the server room
  await expect(page.getByTestId('hud-zone')).toHaveText(await T('zone.D'));
  await expect(page.getByTestId('caption')).toContainText(await T('say.serverIntro'));
  const rv = await richness(page); expect(rv.colours, 'server colours').toBeGreaterThan(60);
  await shot(page, testInfo, o.name + '-08-server-room');
  const closeCopy = async () => { await page.getByTestId('panel-close').click(); await page.waitForTimeout(150); };
  await walkTo(page, c, 8.5); await interact(page, c, 'archive');
  await expect(page.getByTestId('copy-panel')).toBeVisible();
  await shot(page, testInfo, o.name + '-09-copy-archive');
  const take = (id) => c.tap('take-' + id);
  await take('a-left'); await take('a-right');
  if (o.detour) { await take('a-mid'); }                       // the damaged middle looks tempting
  await closeCopy();
  if (o.detour) {
    await walkTo(page, c, 33.5); await interact(page, c, 'mirror');
    await shot(page, testInfo, o.name + '-10-copy-mirror');
    await take('m-mid');                                       // the complete old bridge: a trap
    await closeCopy();
    expect((await snap(page)).backpack).toEqual(['a-left', 'a-right', 'a-mid', 'm-mid']);
    // a full backpack refuses a fifth piece with a clear message
    await walkTo(page, c, 20.5); await interact(page, c, 'lab');
    await take('l-mid');
    await expect(page.getByTestId('copy-feedback')).toHaveText(await T('copy.full'));
    expect((await snap(page)).backpack.length).toBe(4);
    await closeCopy();
  } else {
    await walkTo(page, c, 20.5); await interact(page, c, 'lab');
    await shot(page, testInfo, o.name + '-10-copy-lab');
    await take('l-mid'); await closeCopy();
    expect((await snap(page)).backpack.sort()).toEqual(['a-left', 'a-right', 'l-mid']);
  }
  const climbOut = async () => {
    await walkTo(page, c, 2.5); await interact(page, c, 'exit');
    await sceneIs(page, 'world');
    await c.hold(-1); await until(page, () => window.P3Debug.snapshot().x <= 62.4); await c.jump();
    await until(page, () => { const s = window.P3Debug.snapshot(); return s.onGround && s.y < 10.1; }); await c.release(-1);
    await page.waitForTimeout(100);
  };
  await climbOut();

  // D to C. rebuild the bridge: wrong attempts first, then the right pieces
  await walkTo(page, c, 60.7); await interact(page, c, 'bridge');
  await expect(page.getByTestId('restore-panel')).toBeVisible();
  const rr = await richness(page, 'restore-canvas'); expect(rr.colours, 'restore colours').toBeGreaterThan(60);
  await shot(page, testInfo, o.name + '-11-restore-empty');
  const tryPlace = async (piece, slot) => { await c.tap('piece-' + piece); await c.tap('slot-' + slot); };
  const wrongs = async (list) => {
    for (const [piece, slot, reason] of list) {
      const before = await snap(page);
      await tryPlace(piece, slot);
      await expect(page.getByTestId('feedback')).toContainText(await T('reason.' + reason));
      const after = await snap(page);
      expect(after.placed, `${piece} must not stick in ${slot}`).toEqual(before.placed);
      expect(after.backpack.slice().sort(), 'a refused piece stays in the backpack').toEqual(before.backpack.slice().sort());
      expect(after.wrong).toBe(before.wrong + 1);
    }
  };
  if (o.detour) {
    await wrongs([['a-mid', 's2', 'corrupt'], ['m-mid', 's2', 'build'], ['a-left', 's3', 'shape'], ['a-right', 's1', 'shape']]);
    await shot(page, testInfo, o.name + '-12-wrong-placement');
    // real drag and drop for the first correct piece (keyboard run), tap-select otherwise
    if (o.mode === 'keys') { await page.getByTestId('piece-a-left').dragTo(page.getByTestId('slot-s1')); } else { await tryPlace('a-left', 's1'); }
    await expect(page.getByTestId('feedback')).toHaveText(await T('restore.fits'));
    expect((await snap(page)).placed.s1).toBe('a-left');
    await tryPlace('a-right', 's3');
    await shot(page, testInfo, o.name + '-13-restore-partial');
    // language switch in the middle of the puzzle keeps every placed piece
    if (lang === 'en') {
      await page.getByTestId('lang-toggle').click();
      await expect(page.getByTestId('restore-panel')).toContainText(await tr(page, 'zh', 'restore.title'));
      expect((await snap(page)).placed.s1).toBe('a-left');
      await page.getByTestId('lang-toggle').click();
      await expect(page.getByTestId('restore-panel')).toContainText(await tr(page, 'en', 'restore.title'));
    }
    // leave with an unfinished bridge, reload, and find it exactly as left
    await page.getByTestId('panel-close').click();
    await page.reload(); await page.waitForFunction(() => window.P3Debug);
    await page.getByTestId('continue').click();
    await sceneIs(page, 'world');
    const resumed = await snap(page);
    expect(resumed.placed.s1).toBe('a-left'); expect(resumed.placed.s3).toBe('a-right'); expect(resumed.bridge).toBe(false);
    expect(resumed.backpack.slice().sort()).toEqual(['a-mid', 'm-mid']);
    expect(Math.abs(resumed.x - 60.7)).toBeLessThan(1.0);
    // the middle piece is missing, so go back, put the two wrong pieces down and take the clean one
    await c.hold(1); await until(page, () => { const s = window.P3Debug.snapshot(); return s.onGround && s.y > 11.9; }); await c.release(1);
    await interact(page, c, 'door'); await sceneIs(page, 'server');
    await walkTo(page, c, 8.5); await interact(page, c, 'archive'); await take('a-mid');
    await expect(page.getByTestId('take-a-mid')).toHaveText(await T('copy.take')); await closeCopy();
    await walkTo(page, c, 33.5); await interact(page, c, 'mirror'); await take('m-mid'); await closeCopy();
    await walkTo(page, c, 20.5); await interact(page, c, 'lab'); await take('l-mid'); await closeCopy();
    expect((await snap(page)).backpack).toEqual(['l-mid']);
    await climbOut();
    await walkTo(page, c, 60.7); await interact(page, c, 'bridge');
  } else {
    await wrongs([['l-mid', 's1', 'width'], ['a-left', 's3', 'shape']]);
    await tryPlace('a-left', 's1'); await tryPlace('a-right', 's3');
  }
  await tryPlace('l-mid', 's2');
  await shot(page, testInfo, o.name + '-14-restore-complete');
  expect((await snap(page)).placed).toEqual(SOLUTION);
  mark('bridge-restored');

  // the bridge builds plank by plank, and the player walks across it
  await until(page, () => window.P3Debug.snapshot().panel === null && window.P3Debug.snapshot().building > 0, null, 10000);
  await shot(page, testInfo, o.name + '-15-bridge-building', true);
  await until(page, () => window.P3Debug.snapshot().bridge && !window.P3Debug.snapshot().frozen, null, 15000);
  await shot(page, testInfo, o.name + '-16-bridge-built', true);
  const fallsBefore = (await snap(page)).falls;
  await walkTo(page, c, 68.5);
  await jumpAt(page, c, 70.3, 9, 73);                          // the last plank is one step higher
  expect((await snap(page)).falls).toBe(fallsBefore);
  expect((await snap(page)).x).toBeGreaterThan(72.5);

  // E. the far side and the sea
  await expect(page.getByTestId('hud-zone')).toHaveText(await T('zone.E'));
  await walkTo(page, c, 85.5); await interact(page, c, 'crab');
  await shot(page, testInfo, o.name + '-17-far-side', true);
  await walkTo(page, c, 100.5); await interact(page, c, 'sign5');
  await walkTo(page, c, 118.2);
  const rp = await richness(page); expect(rp.colours, 'pier colours').toBeGreaterThan(70);
  await shot(page, testInfo, o.name + '-18-pier');
  await interact(page, c, 'terminal');
  await expect(page.getByTestId('dialogue')).toBeVisible();
  const lines = [['elena', 'end.elena1'], ['elena', 'end.elena2'], ['elena', 'end.elena3'], ['mara', 'end.mara1']];
  for (let i = 0; i < lines.length; i++) {
    const text = await T(lines[i][1]);
    await page.waitForTimeout(250);
    const partial = (await page.getByTestId('dialogue-text').innerText()).length;
    if (i === 0) { expect(partial, 'text is typed out, not shown at once').toBeLessThan(text.length); await shot(page, testInfo, o.name + '-19-dialogue'); }
    if ((await page.getByTestId('dialogue-text').innerText()).trim() !== text) { await page.getByTestId('dialogue-next').click(); }   // completes the typing
    await expect(page.getByTestId('dialogue-text')).toHaveText(text);
    if (i === lines.length - 1) { await shot(page, testInfo, o.name + '-20-dialogue-mara'); }
    await page.getByTestId('dialogue-next').click();              // next line
  }
  mark('ending-read');

  // the memory island grows in five stages, then can be explored and saved
  await sceneIs(page, 'island'); await expect(page.getByTestId('hud-zone')).toHaveText(await T('zone.island'));
  const seenStages = new Set();
  await until(page, () => { const s = window.P3Debug.snapshot(); return s.island.stage >= 3; }, null, 20000);
  await shot(page, testInfo, o.name + '-21-island-growing', true);
  await until(page, () => window.P3Debug.snapshot().island.done, null, 25000);
  seenStages.add((await snap(page)).island.stage);
  expect([...seenStages]).toEqual([5]);
  await expect(page.getByTestId('replay')).toBeVisible();
  const ri = await richness(page); expect(ri.colours, 'island colours').toBeGreaterThan(80);
  await shot(page, testInfo, o.name + '-22-island-complete');
  const stops = [[9.5, 'cabin'], [12.4, 'console'], [14.6, 'tree'], [17.2, 'photo'], [19.6, 'cassette'], [22.0, 'cat'], [24.2, 'jar'], [26.4, 'note']];
  const list = o.hidden ? stops : stops.filter(([, id]) => id !== 'note');
  await walkTo(page, c, 6.0);
  for (const [x, id] of list) { await walkTo(page, c, x); await interact(page, c, id); }
  await expect(page.getByTestId('hud-stars')).toContainText('/');
  await shot(page, testInfo, o.name + '-23-island-explored');
  const done = await snap(page);
  expect(done.island.seen).toBe(list.length);
  mark('island-explored');

  // the island and every memory in it come back after a reload
  await page.reload(); await page.waitForFunction(() => window.P3Debug);
  await page.getByTestId('continue').click(); await sceneIs(page, 'island');
  const again = await snap(page);
  expect(again.island.done).toBe(true); expect(again.island.seen).toBe(list.length); expect(again.ended).toBe(true);
  await shot(page, testInfo, o.name + '-24-island-after-reload', true);

  const total = (Date.now() - t0) / 1000;
  console.log(`P3_TIME ${o.name} total=${total.toFixed(1)}s ` + Object.keys(marks).map((k) => `${k}=${marks[k].toFixed(1)}s`).join(' ') + '  (automated, not human play time)');
  testInfo.annotations.push({ type: 'automated-seconds', description: total.toFixed(1) });
  return { total, marks };
}

// ---- full playthroughs -----------------------------------------------------------------------------

test.describe('P3.2 full playthrough', () => {
  test.setTimeout(300000);

  test('English, desktop, keyboard: every system, wrong placements, drag and drop, reload, secret garden', async ({ page }, testInfo) => {
    const issues = []; watch(page, issues);
    const r = await playAll(page, testInfo, { name: 'en-desktop', lang: 'en', mode: 'keys', hidden: true, detour: true });
    expect(r.marks['first-interaction'], 'first interaction within 30 s').toBeLessThan(30);
    expect(r.marks['core-gameplay'], 'core gameplay within 2 minutes').toBeLessThan(120);
    const played = await page.evaluate(() => window.P3Audio.heard());   // requests made; whether they were audible is UNVERIFIED
    expect(played).toEqual(expect.arrayContaining(['jump', 'land', 'step', 'star', 'hidden', 'check', 'click', 'thud', 'collect', 'powerup', 'meow', 'server', 'pick', 'putback', 'wrong', 'snap', 'plank', 'bridge', 'door', 'blip', 'grow']));
    expect(issues, issues.join('\n')).toEqual([]);
  });

  test('Chinese, desktop, keyboard: complete level and story in Simplified Chinese', async ({ page }, testInfo) => {
    const issues = []; watch(page, issues);
    await playAll(page, testInfo, { name: 'zh-desktop', lang: 'zh', mode: 'keys', hidden: false, detour: false });
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    expect(issues, issues.join('\n')).toEqual([]);
  });

  test.describe('phone', () => {
    test.use({ viewport: devices['Pixel 5'].viewport, userAgent: devices['Pixel 5'].userAgent, deviceScaleFactor: devices['Pixel 5'].deviceScaleFactor, isMobile: true, hasTouch: true });

    test('English, phone, touch buttons only: complete level, large targets, nothing overlaps the picture', async ({ page }, testInfo) => {
      const issues = []; watch(page, issues);
      await newGameTo(page, 'en');
      await page.getByTestId('start').tap();
      await sceneIs(page, 'study');
      const vp = page.viewportSize();
      const cv = await page.getByTestId('view').boundingBox();
      expect(cv.width, 'picture fits the screen').toBeLessThanOrEqual(vp.width);
      const cap = await page.getByTestId('caption').boundingBox();
      const pad = await page.getByTestId('pad').boundingBox();
      expect(cap.y, 'caption sits under the picture, not over it').toBeGreaterThanOrEqual(cv.y + cv.height - 1);
      expect(pad.y, 'touch pad sits under the caption').toBeGreaterThanOrEqual(cap.y + cap.height - 1);
      for (const id of ['pad-left', 'pad-right', 'pad-jump', 'pad-use']) { const b = await page.getByTestId(id).boundingBox(); expect(b.width, id + ' width').toBeGreaterThanOrEqual(44); expect(b.height, id + ' height').toBeGreaterThanOrEqual(44); }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, 'no sideways scrolling').toBeLessThanOrEqual(1);
      await shot(page, testInfo, 'phone-00-study');
      await page.evaluate(() => localStorage.removeItem('p3.save.v2'));
      await playAll(page, testInfo, { name: 'phone', lang: 'en', mode: 'touch', hidden: false, detour: false });
      expect(issues, issues.join('\n')).toEqual([]);
    });
  });
});

// ---- focused checks --------------------------------------------------------------------------------

// Starts from a fresh save with a few fields set, e.g. { scene: 'world', 'pos.world': { x: 14.5, y: 10 } }.
async function seed(page, lang, patch) {
  await page.addInitScript((l) => { if (!localStorage.getItem('p3.lang.v1')) { localStorage.setItem('p3.lang.v1', l); } }, lang);
  await page.goto(PATH);
  await page.waitForFunction(() => window.P3Debug && window.P3State);
  await page.evaluate((p) => {
    const s = window.P3State.newState();
    Object.keys(p).forEach((path) => { const keys = path.split('.'); let o = s; keys.slice(0, -1).forEach((k) => { o = o[k]; }); o[keys[keys.length - 1]] = p[path]; });
    localStorage.setItem('p3.save.v2', JSON.stringify(s));
  }, patch);
  await page.reload(); await page.waitForFunction(() => window.P3Debug);
  await page.getByTestId('continue').click();
}

test.describe('P3.2 focused checks', () => {
  test.setTimeout(120000);

  test('falling into the stream costs nothing but a second: the player is back at the checkpoint and can try again', async ({ page }, testInfo) => {
    const issues = []; watch(page, issues);
    await seed(page, 'en', { scene: 'world', cp: 1, 'pos.world': { x: 14.5, y: 10 } });
    await sceneIs(page, 'world');
    const c = controls(page, 'keys');
    await c.hold(1);
    await until(page, () => window.P3Debug.snapshot().falls >= 1, null, 15000);
    await c.release(1);
    await captionIs(page, 'say.fall');
    await until(page, () => window.P3Debug.snapshot().onGround, null, 5000);
    const after = await snap(page);
    expect(after.falls).toBe(1); expect(Math.abs(after.x - 13.2)).toBeLessThan(1.0);
    await expect(page.getByTestId('hud-falls')).toContainText('1');
    await shot(page, testInfo, 'retry-after-fall', true);
    await jumpAt(page, c, 16.0, null, 21);                                  // and the retry works
    expect((await snap(page)).x).toBeGreaterThan(20.5);
    expect(issues, issues.join('\n')).toEqual([]);
  });

  test('reduced motion: no typewriter, quick island, settings saved', async ({ browser }, testInfo) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage(); const issues = []; watch(page, issues);
    await seed(page, 'en', { scene: 'world', cp: 7, 'pos.world': { x: 117, y: 10 }, bridge: true, placed: SOLUTION, 'flags.tape': true });
    await sceneIs(page, 'world');
    await expect(page.locator('html')).toHaveClass(/reduce-motion/);
    const c = controls(page, 'keys');
    await interact(page, c, 'terminal');
    await expect(page.getByTestId('dialogue')).toBeVisible();
    await expect(page.getByTestId('dialogue-text')).toHaveText(await tr(page, 'en', 'end.elena1'));    // all at once
    for (let i = 0; i < 4; i++) { await page.getByTestId('dialogue-next').click(); }
    await sceneIs(page, 'island');
    await until(page, () => window.P3Debug.snapshot().island.done, null, 8000);
    await shot(page, testInfo, 'reduced-island');
    // sound and volume settings persist
    await page.getByTestId('sound-toggle').click();
    await expect(page.getByTestId('sound-toggle')).toHaveText(await tr(page, 'en', 'ui.soundOff'));
    await page.getByTestId('volume').fill('30');
    await page.getByTestId('motion-toggle').click();
    await page.reload(); await page.waitForFunction(() => window.P3Debug);
    await expect(page.getByTestId('sound-toggle')).toHaveText(await tr(page, 'en', 'ui.soundOff'));
    expect(await page.evaluate(() => localStorage.getItem('p3.muted.v1'))).toBe('1');
    expect(await page.evaluate(() => localStorage.getItem('p3.volume.v2'))).toBe('0.3');
    expect(issues, issues.join('\n')).toEqual([]);
    await ctx.close();
  });

  test('a damaged or tampered save never blocks the game and never skips the puzzle', async ({ page }) => {
    const issues = []; watch(page, issues);
    await page.goto(PATH);
    await page.evaluate(() => localStorage.setItem('p3.save.v2', '{broken json'));
    await page.reload(); await page.waitForFunction(() => window.P3Debug);
    await expect(page.getByTestId('title-card')).toContainText(await tr(page, 'en', 'ui.saveCorrupt'));
    await expect(page.getByTestId('start')).toBeVisible();
    await page.evaluate(() => localStorage.setItem('p3.save.v2', JSON.stringify({ v: 2, scene: 'island', bridge: true, ended: true, placed: { s1: 'm-left', s2: 'l-arch', s3: 'a-mid' }, island: { stage: 5 } })));
    await page.reload(); await page.waitForFunction(() => window.P3Debug);
    await page.getByTestId('continue').click();
    const s = await snap(page);
    expect(s.scene).toBe('world'); expect(s.bridge).toBe(false); expect(s.placed).toEqual({ s1: null, s2: null, s3: null });
    expect(issues, issues.join('\n')).toEqual([]);
  });

  test('the old four-act game is untouched', async ({ page }) => {
    const res = await page.goto('/');
    expect(res.status()).toBe(200);
    expect((await res.text()).length).toBeGreaterThan(500);
    expect((await page.request.get('/api/health')).ok()).toBe(true);
    expect((await page.request.post('/api/sessions')).status()).toBe(201);
  });
});
