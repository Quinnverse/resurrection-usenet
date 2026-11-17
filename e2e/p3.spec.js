// P3 "A Life in Fragments" browser acceptance (Playwright, Chromium). Run with `npm run test:e2e`.
// Each test starts with an empty localStorage. Some tests load a version 1 save to reach a scene
// quickly, and the save format is the same one the game writes itself.
// Screenshots go to test-results/ and are uploaded as the CI artifact.

const { test, expect, devices } = require('@playwright/test');

const PATH = '/p3/';

function watch(page, issues) {
  page.on('pageerror', (error) => issues.push(`page error: ${error.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    if (/favicon/.test(msg.location().url || '') || /Failed to load resource/.test(msg.text())) return;
    issues.push(`console error: ${msg.text()}`);
  });
}

async function shot(page, testInfo, name) {
  await page.screenshot({ path: testInfo.outputPath(name + '.png') });
  await testInfo.attach(name, { path: testInfo.outputPath(name + '.png'), contentType: 'image/png' });
}

async function holdUntilVisible(page, key, locator, timeout = 20000) {
  await page.keyboard.down(key);
  try {
    await expect(locator).toBeVisible({ timeout });
  } finally {
    await page.keyboard.up(key);
  }
}

async function walkUntilText(page, key, selector, text, timeout = 20000) {
  await page.keyboard.down(key);
  try {
    await expect(page.locator(selector)).toContainText(text, { timeout });
  } finally {
    await page.keyboard.up(key);
  }
}

// Pointer hold for touch buttons. Playwright's dispatchEvent creates plain events, which the pad handlers accept.
async function pointerHold(locator, ms) {
  await locator.dispatchEvent('pointerdown');
  await new Promise((resolve) => setTimeout(resolve, ms));
  await locator.dispatchEvent('pointerup');
}

function save(scene, level) {
  return JSON.stringify({ v: 1, scene, level: Object.assign({ v: 1, phase: 'playing', seenSigns: [], collected: [], deaths: 0 }, level) });
}

test.describe('P3 full playthrough (English, desktop)', () => {
  test('room to computer, wall, restore both servers, door, note, island', async ({ page }, testInfo) => {
    const issues = [];
    watch(page, issues);
    await page.goto(PATH);
    await expect(page.getByTestId('start')).toBeVisible();
    await shot(page, testInfo, '01-title');

    const started = Date.now();
    await page.getByTestId('start').click();
    await expect(page.getByTestId('room-canvas')).toBeVisible();
    await shot(page, testInfo, '02-room');

    // Target within 30 seconds: walk until the computer prompt appears.
    await holdUntilVisible(page, 'ArrowRight', page.getByTestId('room-prompt').filter({ hasText: 'Press E to use the computer.' }));
    const secondsToComputer = (Date.now() - started) / 1000;
    testInfo.annotations.push({ type: 'seconds-to-computer', description: secondsToComputer.toFixed(1) });
    expect(secondsToComputer).toBeLessThan(30);
    await shot(page, testInfo, '03-room-computer-prompt');

    await page.keyboard.press('e');
    await expect(page.getByTestId('computer-panel')).toBeVisible();
    await shot(page, testInfo, '04-computer-panel');
    await page.getByTestId('play').click();

    // Platform section: walk right until the missing edge stops the player.
    await expect(page.getByTestId('game-canvas')).toBeVisible();
    await walkUntilText(page, 'ArrowRight', '#message', 'The game stops here');
    await shot(page, testInfo, '05-missing-edge');

    // Server console: restore the lab route, then the archive.
    await page.keyboard.press('r');
    await expect(page.getByTestId('console')).toBeVisible();
    await page.getByTestId('restore-lab').click();
    await expect(page.getByTestId('console-log')).toHaveText('Lab route restored. The wall is gone.');
    await expect(page.getByTestId('lab-status')).toHaveText('Restored');
    await page.getByTestId('restore-archive').click();
    await expect(page.getByTestId('console-log')).toHaveText('Archive ending restored.');
    await expect(page.getByTestId('archive-status')).toHaveText('Restored');
    await shot(page, testInfo, '06-console-both-restored');
    await page.getByTestId('console-close').click();

    // Walk to the door at the end of the ending segment.
    await holdUntilVisible(page, 'ArrowRight', page.getByTestId('note'), 40000);
    await shot(page, testInfo, '07-note');
    await page.getByTestId('note-next').click();

    // Island: each part is clickable, and the console has the final message.
    await expect(page.getByTestId('island-canvas')).toBeVisible();
    await page.getByTestId('island-console').click();
    await expect(page.getByTestId('island-caption')).toContainText('Thank you for coming back');
    await shot(page, testInfo, '08-island');

    expect(issues, issues.join('\n')).toEqual([]);
  });
});

test.describe('P3 persistence and failure', () => {
  test('refresh resumes the same scene with restored servers', async ({ page }, testInfo) => {
    const issues = [];
    watch(page, issues);
    await page.goto(PATH);
    await page.evaluate((s) => localStorage.setItem('p3.save.v1', s), save('game', {
      x: 18.7, y: 10, lastSafe: { x: 18.7, y: 10 }, flags: { lab: false, archive: false }
    }));
    await page.reload();
    await page.getByTestId('continue').click();
    await expect(page.getByTestId('game-canvas')).toBeVisible();

    await page.keyboard.press('r');
    await page.getByTestId('restore-lab').click();
    await expect(page.getByTestId('lab-status')).toHaveText('Restored');
    await page.keyboard.press('r');

    await page.reload();
    await page.getByTestId('continue').click();
    await expect(page.getByTestId('game-canvas')).toBeVisible();
    await page.keyboard.press('r');
    await expect(page.getByTestId('lab-status')).toHaveText('Restored');
    await shot(page, testInfo, '09-resumed-after-reload');
    expect(issues, issues.join('\n')).toEqual([]);
  });

  test('falling returns the player to ground and the retry shows the gap hint', async ({ page }, testInfo) => {
    const issues = [];
    watch(page, issues);
    await page.goto(PATH);
    await page.evaluate((s) => localStorage.setItem('p3.save.v1', s), save('game', {
      x: 26.5, y: 10, lastSafe: { x: 26.5, y: 10 }, flags: { lab: true, archive: false }
    }));
    await page.reload();
    await page.getByTestId('continue').click();
    await expect(page.getByTestId('game-canvas')).toBeVisible();

    await walkUntilText(page, 'ArrowRight', '#message', 'You fell', 25000);
    await expect(page.locator('#hud')).toContainText('Falls: 1');
    await expect(page.getByTestId('game-canvas')).toBeVisible();
    await shot(page, testInfo, '10-after-fall');
    expect(issues, issues.join('\n')).toEqual([]);
  });
});

test.describe('P3 Chinese', () => {
  test('Chinese interface, computer, wall and island', async ({ page }, testInfo) => {
    const issues = [];
    watch(page, issues);
    await page.goto(PATH);
    await page.evaluate(() => localStorage.setItem('p3.lang.v1', 'zh'));
    await page.reload();
    await expect(page.getByTestId('start')).toHaveText('开始');
    await shot(page, testInfo, '11-zh-title');
    await page.getByTestId('start').click();
    await holdUntilVisible(page, 'ArrowRight', page.getByTestId('room-prompt').filter({ hasText: '按 E 使用电脑。' }));
    await page.keyboard.press('e');
    await expect(page.getByTestId('computer-panel')).toContainText('月光跳跳（1998）');
    await page.getByTestId('play').click();
    await walkUntilText(page, 'ArrowRight', '#message', '游戏在这里停住了');
    await shot(page, testInfo, '12-zh-missing-edge');
    expect(issues, issues.join('\n')).toEqual([]);
  });

  test('Chinese island after completion', async ({ page }, testInfo) => {
    const issues = [];
    watch(page, issues);
    await page.goto(PATH);
    await page.evaluate((s) => {
      localStorage.setItem('p3.lang.v1', 'zh');
      localStorage.setItem('p3.save.v1', s);
    }, save('island', {
      phase: 'complete', x: 36.5, y: 10, lastSafe: { x: 36.5, y: 10 },
      flags: { lab: true, archive: true }, collected: ['17,3']
    }));
    await page.reload();
    await page.getByTestId('continue').click();
    await expect(page.getByTestId('island-canvas')).toBeVisible();
    await page.getByTestId('island-console').click();
    await expect(page.getByTestId('island-caption')).toContainText('谢谢你为我回来');
    await shot(page, testInfo, '13-zh-island');
    expect(issues, issues.join('\n')).toEqual([]);
  });
});

test.describe('P3 mobile touch', () => {
  test.use({ ...devices['Pixel 5'] });

  test('the whole path works with touch buttons only', async ({ page }, testInfo) => {
    const issues = [];
    watch(page, issues);
    await page.goto(PATH);
    await page.getByTestId('start').tap();
    await expect(page.getByTestId('room-canvas')).toBeVisible();
    await shot(page, testInfo, '14-mobile-room');

    const pad = page.locator('.pad').first();
    const right = pad.getByRole('button', { name: 'Right', exact: true });
    const use = pad.getByRole('button', { name: 'Use', exact: true });
    for (const btn of [right, use]) {
      const box = await btn.boundingBox();
      expect(box.height, 'touch target height').toBeGreaterThanOrEqual(40);
    }

    const prompt = page.getByTestId('room-prompt').filter({ hasText: 'Press E to use the computer.' });
    for (let i = 0; i < 40 && !(await prompt.isVisible()); i++) {
      await pointerHold(right, 300);
    }
    await expect(prompt).toBeVisible();
    await use.tap();
    await expect(page.getByTestId('computer-panel')).toBeVisible();
    await page.getByTestId('play').tap();

    await expect(page.getByTestId('game-canvas')).toBeVisible();
    const gameRight = page.locator('.pad').first().getByRole('button', { name: 'Right', exact: true });
    for (let i = 0; i < 40; i++) {
      if (await page.locator('#message').textContent().then((t) => /The game stops here/.test(t))) break;
      await pointerHold(gameRight, 400);
    }
    await expect(page.locator('#message')).toContainText('The game stops here');
    await page.getByTestId('servers').tap();
    await page.getByTestId('restore-lab').tap();
    await expect(page.getByTestId('lab-status')).toHaveText('Restored');
    await shot(page, testInfo, '15-mobile-console');

    const canvasBox = await page.getByTestId('game-canvas').boundingBox();
    const viewport = page.viewportSize();
    expect(canvasBox.width).toBeLessThanOrEqual(viewport.width);
    expect(issues, issues.join('\n')).toEqual([]);
  });
});

test.describe('P3 settings', () => {
  test.use({ reducedMotion: 'reduce' });

  test('sound and motion settings persist and reduced motion disables the scene fade', async ({ page }, testInfo) => {
    const issues = [];
    watch(page, issues);
    await page.goto(PATH);
    await page.getByTestId('start').click();
    await expect(page.getByTestId('sound-toggle')).toHaveText('Sound: on');
    await page.getByTestId('sound-toggle').click();
    await expect(page.getByTestId('sound-toggle')).toHaveText('Sound: off');
    expect(await page.evaluate(() => localStorage.getItem('p3.muted.v1'))).toBe('1');

    await page.getByTestId('motion-toggle').click();
    await expect(page.getByTestId('motion-toggle')).toHaveText('Motion: reduced');
    expect(await page.evaluate(() => localStorage.getItem('p3.motion.v1'))).toBe('reduce');

    await page.reload();
    await expect(page.getByTestId('sound-toggle')).toHaveText('Sound: off');
    const animation = await page.evaluate(() => getComputedStyle(document.querySelector('.scene')).animationName);
    expect(animation).toBe('none');

    const autosave = await page.evaluate(() => localStorage.getItem('p3.save.v1'));
    expect(autosave, 'a save exists after starting').not.toBeNull();
    await shot(page, testInfo, '16-settings');
    expect(issues, issues.join('\n')).toEqual([]);
  });
});
